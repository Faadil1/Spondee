import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import {
  CategorySchema,
  EvidenceRunInputSchema,
  TaskSchema,
  type ActivationRecord,
} from "./contracts.js";
import { getAgent, listAgents, referenceAgentForCategory } from "./catalog.js";
import { buildPromiseCard, buildSimulationReceipt, taskCategory } from "./engines.js";
import { buildAgentAdvantageReport, calibrationSummary } from "./evidence.js";
import {
  liveGateStatus,
  publicTestnetReadiness,
  runSignedZeroPriceTestnetActivation,
} from "./erc8183.js";
import type { SpondeeStore } from "./store.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createApp(store: SpondeeStore) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, service: "spondee-backend", version: "0.1.0" });
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
      if (
        promise.scenario_id !== parsedTask.data.scenario_id ||
        promise.category !== taskCategory(parsedTask.data)
      ) {
        return res.status(409).json({ error: "task does not match stored Promise Card" });
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
      const result = await runSignedZeroPriceTestnetActivation(activation.task);
      activation.status = result.status === "COMPLETED" ? "COMPLETED" : "CHAIN_SUBMITTED";
      activation.chain.job_id = result.job_id;
      activation.chain.tx_hashes = result.create_job_tx ? [result.create_job_tx] : [];
      activation.chain.deliverable_url = result.deliverable_url;
      activation.updated_at = new Date().toISOString();
      activation.failure_reason = null;
      await store.putActivation(activation);
      return res.json({ activation, live_result: result });
    } catch (error) {
      const activation = await store.getActivation(req.params.id).catch(() => null);
      if (activation) {
        activation.status = "FAILED";
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
