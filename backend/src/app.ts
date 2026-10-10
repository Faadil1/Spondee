import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  CategorySchema,
  EvidenceRunInputSchema,
  TaskSchema,
  type ActivationRecord,
  type OutcomeReceipt,
} from "./contracts.js";
import { getAgent, listAgents, referenceAgentForCategory } from "./catalog.js";
import { DEMO_TASKS } from "./examples.js";
import { buildPromiseCard, buildSimulationReceipt, taskCategory, taskMatchesPromise } from "./engines.js";
import { buildAgentAdvantageReport, calibrationSummary } from "./evidence.js";
import {
  liveGateStatus,
  publicTestnetReadiness,
  runSignedZeroPriceTestnetActivation,
  type LiveActivationProgress,
} from "./erc8183.js";
import type { SpondeeStore } from "./store.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function appendTx(activation: ActivationRecord, tx?: string): void {
  if (tx && !activation.chain.tx_hashes.includes(tx)) {
    activation.chain.tx_hashes.push(tx);
  }
}

export function createApp(store: SpondeeStore) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));
  const workbenchDir = fileURLToPath(new URL("../public/", import.meta.url));
  app.use("/workbench-assets", express.static(workbenchDir, { index: false, dotfiles: "deny" }));
  app.get("/workbench", (_req, res) => {
    res.set("Cache-Control", "no-store");
    return res.sendFile(fileURLToPath(new URL("../public/workbench.html", import.meta.url)));
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "spondee-backend", version: "0.1.0" });
  });

  app.get("/v1/scenario-starters", (_req, res) => {
    res.json({
      classification: "EDITABLE_SIMULATION_STARTERS_NOT_LIVE_MARKET_OBSERVATIONS",
      tasks: DEMO_TASKS,
    });
  });

  app.get("/v1/categories", (_req, res) => {
    res.json({
      categories: CategorySchema.options.map((category) => ({
        category,
        reference_agent: referenceAgentForCategory(category),
      })),
    });
  });

  app.get("/v1/agents", (req, res) => {
    const raw = typeof req.query.category === "string" ? req.query.category : undefined;
    if (raw === undefined) return res.json({ agents: listAgents() });
    const parsed = CategorySchema.safeParse(raw);
    if (!parsed.success) return res.status(400).json({ error: "invalid category" });
    return res.json({ agents: listAgents(parsed.data) });
  });

  app.get("/v1/agents/:id", (req, res) => {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: "agent not found" });
    return res.json({ agent });
  });

  app.get("/v1/identity/:id", (req, res) => {
    const agent = getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: "agent not found" });
    return res.json({
      agent_id: agent.agent_id,
      identity: agent.identity,
      substrate_policy:
        "8004scan/ERC-8004 metadata is identity/capability substrate only; Spondee does not convert it into an unsupported performance claim.",
    });
  });

  app.post("/v1/promises/preview", async (req, res, next) => {
    try {
      const parsedTask = TaskSchema.safeParse(req.body?.task ?? req.body);
      if (!parsedTask.success) {
        return res.status(400).json({ error: "invalid task", details: parsedTask.error.flatten() });
      }
      const category = taskCategory(parsedTask.data);
      const requestedAgent = typeof req.body?.agent_id === "string" ? getAgent(req.body.agent_id) : null;
      const agent = requestedAgent ?? referenceAgentForCategory(category);
      if (!agent) return res.status(404).json({ error: "agent not found" });
      if (agent.category !== category) {
        return res.status(409).json({ error: "agent category does not match task category" });
      }
      if (agent.identity.source !== "SPONDEE") {
        return res.status(409).json({
          error: "external discovery-only agents cannot emit Spondee promises until an activation adapter is verified",
        });
      }
      const promise = buildPromiseCard(parsedTask.data, agent.agent_id, agent.version, 0n);
      await store.putPromise(promise);
      return res.status(201).json({ promise });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/v1/promises/:id", async (req, res, next) => {
    try {
      const promise = await store.getPromise(req.params.id);
      if (!promise) return res.status(404).json({ error: "promise not found" });
      return res.json({ promise });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/v1/activations", async (req, res, next) => {
    try {
      const promiseId = typeof req.body?.promise_id === "string" ? req.body.promise_id : "";
      const promise = await store.getPromise(promiseId);
      if (!promise) return res.status(404).json({ error: "promise not found" });
      const parsedTask = TaskSchema.safeParse(req.body?.task);
      if (!parsedTask.success) {
        return res.status(400).json({ error: "invalid task", details: parsedTask.error.flatten() });
      }
      if (!taskMatchesPromise(parsedTask.data, promise)) {
        return res.status(409).json({
          error: "the activation task differs from the full user-approved Promise Card; create a new preview before activation",
        });
      }
      const mode = req.body?.mode === "LIVE_TESTNET" ? "LIVE_TESTNET" : "SIMULATION";
      const now = new Date().toISOString();
      const activation: ActivationRecord = {
        activation_id: `sa_${randomUUID()}`,
        agent_id: promise.agent_id,
        category: promise.category,
        promise_id: promise.promise_id,
        scenario_id: promise.scenario_id,
        mode,
        status: "PREPARED",
        task: parsedTask.data,
        promise,
        receipt_id: null,
        chain: {
          network: mode === "LIVE_TESTNET" ? "bsc-testnet" : null,
          job_id: null,
          tx_hashes: [],
          deliverable_url: null,
        },
        created_at: now,
        updated_at: now,
        failure_reason: null,
      };

      if (mode === "SIMULATION") {
        const receipt = buildSimulationReceipt(parsedTask.data, promise);
        await store.putReceipt(receipt);
        activation.receipt_id = receipt.receipt_id;
        activation.status = "SIMULATED";
      } else if (!liveGateStatus().ready_for_live_write) {
        activation.status = "BLOCKED_LIVE_GATE";
        activation.failure_reason =
          "Live testnet execution is prepared but disabled until explicit runtime gate + buyer keystore + seller endpoint are configured.";
      }
      await store.putActivation(activation);
      return res.status(201).json({ activation });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/v1/activations/:id", async (req, res, next) => {
    try {
      const activation = await store.getActivation(req.params.id);
      if (!activation) return res.status(404).json({ error: "activation not found" });
      return res.json({ activation });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/v1/activations/:id/live-testnet", async (req, res, next) => {
    try {
      const activation = await store.getActivation(req.params.id);
      if (!activation) return res.status(404).json({ error: "activation not found" });
      if (activation.mode !== "LIVE_TESTNET") {
        return res.status(409).json({ error: "activation was not prepared for LIVE_TESTNET" });
      }
      if (activation.task.schema !== "spondee.health-factor.task.v1") {
        return res.status(409).json({
          error: "other categories require their own deployed, verified seller before live activation",
        });
      }
      if (!taskMatchesPromise(activation.task, activation.promise)) {
        return res.status(409).json({ error: "stored task differs from committed Promise Card" });
      }
      if (!liveGateStatus().ready_for_live_write) {
        return res.status(409).json({
          error: "live activation gate remains disabled; no chain job attempted",
        });
      }
      const claimed = await store.claimLiveActivation(activation.activation_id);
      if (!claimed) {
        return res.status(409).json({
          error: "activation already started, completed or blocked; inspect existing job, never blindly resubmit",
        });
      }

      const onProgress = async (progress: LiveActivationProgress) => {
        claimed.chain.job_id = progress.job_id;
        appendTx(claimed, progress.transaction_hash);
        if (progress.deliverable_url) claimed.chain.deliverable_url = progress.deliverable_url;
        if (progress.stage === "FUND") claimed.status = "CHAIN_FUNDED";
        if (progress.stage === "SUBMIT_OBSERVED" || progress.stage === "DELIVERABLE_VERIFIED") {
          claimed.status = "CHAIN_SUBMITTED";
        }
        claimed.updated_at = new Date().toISOString();
        await store.putActivation(claimed);
      };

      const result = await runSignedZeroPriceTestnetActivation(
        claimed.task,
        process.env,
        onProgress,
      );
      if (result.promise_id !== claimed.promise_id) {
        throw new Error("live signed Promise Card does not match the stored activation Promise Card");
      }

      const rawReceipt = result.deliverable.receipt;
      const rawCalibration = objectOrEmpty(rawReceipt.calibration);
      const receipt: OutcomeReceipt = {
        schema: "spondee.outcome-receipt.v1",
        receipt_id: `sr_chain_${result.job_id}`,
        category: claimed.category,
        promise_id: claimed.promise_id,
        scenario_id: claimed.scenario_id,
        agent_id: claimed.agent_id,
        evidence_class: "SIMULATION",
        actual_outcome: objectOrEmpty(rawReceipt.outcome),
        actual_cost: { currency: "raw_erc8183_wei", amount: "0" },
        tx_hashes: Object.values(result.transactions).filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        ),
        created_at: new Date().toISOString(),
        calibration: {
          eligible_for_observed_agent_advantage: false,
          status: "NOT_OBSERVED_MARKET_EVIDENCE",
        },
        claim_guardrail:
          typeof rawReceipt.claim_guardrail === "string"
            ? rawReceipt.claim_guardrail
            : "Live ERC-8183 transport was observed on BSC Testnet, but the declared Health Factor scenario remains simulation evidence and is excluded from observed Agent Advantage.",
      };
      if (rawCalibration.eligible_for_observed_agent_advantage !== false) {
        throw new Error("verified live deliverable violated the simulation Agent Advantage guardrail");
      }

      await store.putReceipt(receipt);
      claimed.receipt_id = receipt.receipt_id;
      claimed.status = result.status === "COMPLETED" ? "COMPLETED" : "CHAIN_SUBMITTED";
      claimed.chain.job_id = result.job_id;
      claimed.chain.tx_hashes = receipt.tx_hashes;
      claimed.chain.deliverable_url = result.deliverable.url;
      claimed.updated_at = new Date().toISOString();
      claimed.failure_reason = null;
      await store.putActivation(claimed);
      return res.json({ activation: claimed, receipt, live_result: result });
    } catch (error) {
      const activation = await store.getActivation(req.params.id).catch(() => null);
      if (activation && activation.mode === "LIVE_TESTNET" &&
          (activation.status === "LIVE_IN_FLIGHT" ||
           activation.status === "CHAIN_FUNDED" ||
           activation.status === "CHAIN_SUBMITTED")) {
        // If a chain stage or durable claim may already exist, do not
        // downgrade the outcome to FAILED or permit another blind send.
        // Human/operator reconciliation must inspect the existing job.
        activation.status = "CHAIN_UNKNOWN";
        activation.failure_reason = errorMessage(error);
        activation.updated_at = new Date().toISOString();
        await store.putActivation(activation).catch(() => undefined);
      }
      return next(error);
    }
  });

  app.get("/v1/receipts/:id", async (req, res, next) => {
    try {
      const receipt = await store.getReceipt(req.params.id);
      if (!receipt) return res.status(404).json({ error: "receipt not found" });
      return res.json({ receipt });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/v1/evidence/baselines", async (req, res, next) => {
    try {
      const parsed = EvidenceRunInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "invalid evidence run", details: parsed.error.flatten() });
      }
      await store.putEvidence(parsed.data);
      return res.status(201).json({ evidence: parsed.data });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/v1/evidence/agent-advantage", async (_req, res, next) => {
    try {
      return res.json({ report: buildAgentAdvantageReport(await store.listEvidence()) });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/v1/agents/:id/calibration", async (req, res, next) => {
    try {
      if (!getAgent(req.params.id)) return res.status(404).json({ error: "agent not found" });
      return res.json({ calibration: calibrationSummary(await store.listEvidence(), req.params.id) });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/v1/runtime/readiness", async (_req, res) => {
    const gate = liveGateStatus();
    try {
      const publicChain = await publicTestnetReadiness();
      return res.json({ live_gate: gate, public_chain: publicChain });
    } catch (error) {
      return res.status(503).json({
        live_gate: gate,
        public_chain: null,
        read_probe_error: errorMessage(error),
        live_write_attempted: false,
      });
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: errorMessage(error) });
  });

  return app;
}
