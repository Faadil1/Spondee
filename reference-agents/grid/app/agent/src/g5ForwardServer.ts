import { randomUUID } from "node:crypto";
import express from "express";
import {
  buildForwardPromise,
  commitmentForPromise,
  commitmentFromTerms,
  decodeForwardTask,
  encodeCommitment,
  executeForwardObservedTask,
  type ForwardTask,
} from "./g5ForwardObserved.js";
import {
  clampPrice,
  jobSpec,
  listPrice,
  signQuote,
  submitResult,
  verifySignedJob,
} from "./signing.js";

const PORT = Number(process.env.AGENT_PORT || 9000);

function dataFromRpc(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return {};
  const root = body as Record<string, unknown>;
  const params = root.params;
  if (params === null || typeof params !== "object" || Array.isArray(params)) return {};
  const message = (params as Record<string, unknown>).message;
  if (message === null || typeof message !== "object" || Array.isArray(message)) return {};
  const parts = (message as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return {};
  for (const part of parts) {
    if (part !== null && typeof part === "object" && !Array.isArray(part)) {
      const p = part as Record<string, unknown>;
      if (p.kind === "data" && p.data !== null && typeof p.data === "object" && !Array.isArray(p.data)) {
        return p.data as Record<string, unknown>;
      }
    }
  }
  return {};
}

function rpcReply(id: unknown, data: Record<string, unknown>) {
  return {
    jsonrpc: "2.0",
    id: id ?? 1,
    result: {
      kind: "message",
      role: "agent",
      messageId: randomUUID(),
      parts: [{ kind: "data", data }],
    },
  };
}

function taskFromData(data: Record<string, unknown>): ForwardTask | null {
  const direct = decodeForwardTask(data.task_description);
  if (direct) return direct;
  const request = data.request;
  if (request !== null && typeof request === "object" && !Array.isArray(request)) {
    return decodeForwardTask((request as Record<string, unknown>).task_description);
  }
  return null;
}

async function preview(data: Record<string, unknown>) {
  const task = taskFromData(data);
  if (!task) return { status: "rejected", error: "expected spondee.grid-forward-observed.task.v1" };
  const price = clampPrice(listPrice());
  if (price !== 0n) return { status: "rejected", error: "G5 observed proof requires zero service price" };
  return { status: "ok", promise: buildForwardPromise(task, "0") };
}

async function negotiate(data: Record<string, unknown>) {
  const task = taskFromData(data);
  if (!task) return { status: "rejected", error: "expected spondee.grid-forward-observed.task.v1" };
  const price = clampPrice(listPrice());
  if (price !== 0n) return { status: "rejected", error: "G5 observed proof requires zero service price" };
  const request0 = data.request !== null && typeof data.request === "object" && !Array.isArray(data.request)
    ? data.request as Record<string, unknown>
    : { task_description: data.task_description, terms: data.terms ?? {} };
  const promise = buildForwardPromise(task, "0");
  const terms0 = request0.terms !== null && typeof request0.terms === "object" && !Array.isArray(request0.terms)
    ? request0.terms as Record<string, unknown>
    : {};
  const criteria = Array.isArray(terms0.success_criteria)
    ? terms0.success_criteria.filter((x): x is string => typeof x === "string" && !x.startsWith("SPONDEE_G5_GRID_FORWARD_COMMITMENT_V1:"))
    : [];
  const request = {
    ...request0,
    task_description: data.task_description ?? request0.task_description,
    terms: {
      ...terms0,
      success_criteria: [...criteria, encodeCommitment(promise)],
    },
  };
  return signQuote(request, 0n);
}

async function notifyFunded(data: Record<string, unknown>) {
  if (data.wait_for_result !== true) {
    return { status: "rejected", error: "G5 forward evidence requires bounded wait_for_result=true" };
  }
  let jobId: number;
  try { jobId = Number(BigInt(String(data.job_id ?? ""))); }
  catch { return { status: "rejected", error: "invalid job_id" }; }
  if (!Number.isSafeInteger(jobId) || jobId <= 0) return { status: "rejected", error: "invalid job_id" };

  const verdict = await verifySignedJob(jobId);
  if (!verdict.ok) return { status: "rejected", job_id: jobId, error: verdict.reason, permanent: verdict.permanent };
  const spec = await jobSpec(jobId);
  if (!spec) return { status: "rejected", job_id: jobId, error: "missing structured job spec" };
  const task = decodeForwardTask(spec.task);
  if (!task) return { status: "rejected", job_id: jobId, error: "job is not a G5 Grid forward observed task" };
  const commitment = commitmentFromTerms(spec.terms);
  if (!commitment) return { status: "rejected", job_id: jobId, error: "missing unique G5 Grid commitment" };
  const promise = buildForwardPromise(task, "0");
  const expected = commitmentForPromise(promise);
  if (
    commitment.promise_id !== expected.promise_id ||
    commitment.promise_sha256 !== expected.promise_sha256 ||
    commitment.scenario_id !== expected.scenario_id ||
    commitment.price_raw !== "0"
  ) {
    return { status: "rejected", job_id: jobId, error: "G5 Grid Promise commitment mismatch" };
  }

  const output = await executeForwardObservedTask(task, promise);
  const responseContent = JSON.stringify(output, null, 2);
  const submitted = await submitResult(jobId, responseContent, {
    schema: "spondee.g5-grid-forward-observed-metadata.v1",
    scenario_id: task.scenario_id,
    promise_id: promise.promise_id,
    evidence_class: "OBSERVED",
    market_data_execution: "READ_ONLY_BSC_MAINNET_CHAINLINK",
    mainnet_value_moved: false,
  });
  return {
    ok: true,
    job_id: jobId,
    tx_hash: submitted.submitTx,
    deliverable_url: submitted.deliverableUrl,
    promise_id: promise.promise_id,
    observation_started_at: output.observation_started_at,
    observation_completed_at: output.observation_completed_at,
    observed_round_count: output.rounds.length,
  };
}

export async function dispatchG5ForwardSkill(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (data.skill === "g5_grid_forward_preview") return preview(data);
  if (data.skill === "negotiate") return negotiate(data);
  if (data.skill === "notify_funded") return notifyFunded(data);
  return { status: "rejected", error: `unknown skill: ${String(data.skill ?? "missing")}` };
}

export function buildG5ForwardApp() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.get("/ping", (_req, res) => res.json({ status: "HEALTHY", mode: "G5_GRID_FORWARD_OBSERVED" }));
  app.post("/", async (req, res) => {
    const id = req.body?.id;
    try {
      const data = dataFromRpc(req.body);
      const result = await dispatchG5ForwardSkill(data);
      res.json(rpcReply(id, result));
    } catch (error) {
      res.status(500).json({ jsonrpc: "2.0", id: id ?? 1, error: { code: -32603, message: error instanceof Error ? error.message : "seller failure" } });
    }
  });
  return app;
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}` || process.argv[1]?.endsWith("g5ForwardServer.ts")) {
  const app = buildG5ForwardApp();
  app.listen(PORT, "127.0.0.1", () => {
    console.log(`[g5-grid-forward-seller] serving on 127.0.0.1:${PORT}`);
  });
}
