import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { DEMO_TASKS } from "./examples.js";
import { MemoryStore } from "./store.js";

async function withServer(
  env: NodeJS.ProcessEnv,
  fn: (base: string, store: MemoryStore) => Promise<void>,
) {
  const store = new MemoryStore();
  await store.init();
  const server = createApp(store, env).listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, store);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await store.close();
  }
}

async function createSimulationActivation(base: string) {
  const task = DEMO_TASKS[0]!;
  const preview = await fetch(`${base}/v1/promises/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task }),
  });
  const previewBody = await preview.json() as { promise: { promise_id: string } };
  const activation = await fetch(`${base}/v1/activations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ promise_id: previewBody.promise.promise_id, task, mode: "SIMULATION" }),
  });
  return activation.json() as Promise<{ activation: { activation_id: string } }>;
}

test("Decision Replay endpoint is read-only and available for completed simulation", async () => {
  await withServer({}, async (base) => {
    const { activation } = await createSimulationActivation(base);
    const response = await fetch(`${base}/v1/activations/${activation.activation_id}/replay`);
    assert.equal(response.status, 200);
    const body = await response.json() as { replay: { schema: string; replay_mode: string; truth: { reexecution_performed: boolean } } };
    assert.equal(body.replay.schema, "spondee.decision-replay.v1");
    assert.equal(body.replay.replay_mode, "READ_ONLY_RECONSTRUCTION");
    assert.equal(body.replay.truth.reexecution_performed, false);
  });
});

test("evidence ingestion is protected, immutable and idempotent", async () => {
  const env = { SPONDEE_EVIDENCE_INGEST_TOKEN: "evidence-ingest-token-123456789" };
  await withServer(env, async (base) => {
    const evidence = {
      run_id: "observed-test-001",
      category: "Grid Trading",
      scenario_id: "scenario-001",
      agent_id: "spondee-grid",
      version: "0.1.0",
      evidence_class: "OBSERVED",
      promise_timestamp: "2026-09-04T10:00:00.000Z",
      expected_outcome: { terminal_equity_usd: 10000 },
      confidence: null,
      expected_downside: { max_drawdown_usd: 100 },
      expected_cost: { usd: 0 },
      tx_hashes: [],
      actual_outcome: { terminal_equity_usd: 9999 },
      actual_cost: { usd: 0 },
      output_artifacts: [],
    };

    const unauthenticated = await fetch(`${base}/v1/evidence/baselines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(evidence),
    });
    assert.equal(unauthenticated.status, 401);

    const headers = {
      "content-type": "application/json",
      authorization: "Bearer evidence-ingest-token-123456789",
    };
    const first = await fetch(`${base}/v1/evidence/baselines`, {
      method: "POST", headers, body: JSON.stringify(evidence),
    });
    assert.equal(first.status, 201);

    const second = await fetch(`${base}/v1/evidence/baselines`, {
      method: "POST", headers, body: JSON.stringify(evidence),
    });
    assert.equal(second.status, 200);
    const secondBody = await second.json() as { idempotent: boolean };
    assert.equal(secondBody.idempotent, true);

    const mutated = await fetch(`${base}/v1/evidence/baselines`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...evidence, notes: "mutated later" }),
    });
    assert.equal(mutated.status, 409);
  });
});

test("live action requires product authorization before runtime gate and never writes in test", async () => {
  await withServer({ SPONDEE_ACTION_TOKEN: "action-token-123456789012345678" }, async (base, store) => {
    const task = DEMO_TASKS[0]!;
    const preview = await fetch(`${base}/v1/promises/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const previewBody = await preview.json() as { promise: { promise_id: string } };
    const prepared = await fetch(`${base}/v1/activations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promise_id: previewBody.promise.promise_id, task, mode: "LIVE_TESTNET" }),
    });
    const preparedBody = await prepared.json() as { activation: { activation_id: string; status: string } };
    assert.equal(preparedBody.activation.status, "BLOCKED_LIVE_GATE");

    const noToken = await fetch(`${base}/v1/activations/${preparedBody.activation.activation_id}/live-testnet`, { method: "POST" });
    assert.equal(noToken.status, 401);

    const withToken = await fetch(`${base}/v1/activations/${preparedBody.activation.activation_id}/live-testnet`, {
      method: "POST",
      headers: { authorization: "Bearer action-token-123456789012345678" },
    });
    assert.equal(withToken.status, 503);
    assert.equal(store.operationLocks.size, 0);
    const activation = await store.getActivation(preparedBody.activation.activation_id);
    assert.equal(activation?.chain.tx_hashes.length, 0);
  });
});

test("backend readiness fails closed until production configuration is present", async () => {
  await withServer({}, async (base) => {
    const response = await fetch(`${base}/v1/runtime/backend-readiness`);
    assert.equal(response.status, 503);
    const body = await response.json() as { backend_code_status: string; public_deployment_ready: boolean; blocking_configuration: string[] };
    assert.equal(body.backend_code_status, "COMPLETE_FOR_FRONTEND_V1");
    assert.equal(body.public_deployment_ready, false);
    assert.ok(body.blocking_configuration.length >= 1);
  });
});
