import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { DEMO_TASKS } from "./examples.js";
import { MemoryStore } from "./store.js";

async function withServer(fn: (base: string, store: MemoryStore) => Promise<void>) {
  const store = new MemoryStore();
  await store.init();
  const server = createApp(store).listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`, store);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await store.close();
  }
}

test("marketplace exposes four first-class categories", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/v1/categories`);
    assert.equal(response.status, 200);
    const body = await response.json() as { categories: unknown[] };
    assert.equal(body.categories.length, 4);
  });
});

test("each category completes Promise -> simulation activation -> Outcome Receipt", async () => {
  await withServer(async (base) => {
    for (const task of DEMO_TASKS) {
      const previewResponse = await fetch(`${base}/v1/promises/preview`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task }),
      });
      assert.equal(previewResponse.status, 201);
      const preview = await previewResponse.json() as {
        promise: { promise_id: string; confidence: number | null; expected_cost: { amount: string } };
      };
      assert.equal(preview.promise.confidence, null);
      assert.equal(preview.promise.expected_cost.amount, "0");

      const activationResponse = await fetch(`${base}/v1/activations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          promise_id: preview.promise.promise_id,
          task,
          mode: "SIMULATION",
        }),
      });
      assert.equal(activationResponse.status, 201);
      const activationBody = await activationResponse.json() as {
        activation: { status: string; receipt_id: string | null };
      };
      assert.equal(activationBody.activation.status, "SIMULATED");
      assert.ok(activationBody.activation.receipt_id);

      const receiptResponse = await fetch(
        `${base}/v1/receipts/${activationBody.activation.receipt_id}`,
      );
      assert.equal(receiptResponse.status, 200);
      const receiptBody = await receiptResponse.json() as {
        receipt: {
          promise_id: string;
          evidence_class: string;
          calibration: { eligible_for_observed_agent_advantage: boolean };
        };
      };
      assert.equal(receiptBody.receipt.promise_id, preview.promise.promise_id);
      assert.equal(receiptBody.receipt.evidence_class, "SIMULATION");
      assert.equal(receiptBody.receipt.calibration.eligible_for_observed_agent_advantage, false);
    }
  });
});

test("live activation is prepared but fail-closed when runtime gate is absent", async () => {
  await withServer(async (base) => {
    const task = DEMO_TASKS[0];
    const previewResponse = await fetch(`${base}/v1/promises/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const preview = await previewResponse.json() as { promise: { promise_id: string } };
    const activationResponse = await fetch(`${base}/v1/activations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        promise_id: preview.promise.promise_id,
        task,
        mode: "LIVE_TESTNET",
      }),
    });
    const body = await activationResponse.json() as {
      activation: { status: string; failure_reason: string | null };
    };
    assert.equal(body.activation.status, "BLOCKED_LIVE_GATE");
    assert.match(body.activation.failure_reason ?? "", /disabled/i);
  });
});

test("external discovery-only agent cannot manufacture a Spondee Promise Card", async () => {
  await withServer(async (base) => {
    const task = DEMO_TASKS.find((value) => value.schema === "spondee.yield.task.v1")!;
    const response = await fetch(`${base}/v1/promises/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, agent_id: "8004scan-defimatrix-171927" }),
    });
    assert.equal(response.status, 409);
  });
});


test("all four categories refuse changed task parameters after a Promise preview", async () => {
  await withServer(async (base, store) => {
    for (const original of DEMO_TASKS) {
      const task = structuredClone(original);
      const previewResponse = await fetch(`${base}/v1/promises/preview`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ task }),
      });
      assert.equal(previewResponse.status, 201);
      const { promise } = await previewResponse.json() as { promise: { promise_id: string } };
      const altered = structuredClone(task);
      switch (altered.schema) {
        case "spondee.health-factor.task.v1": altered.hf_floor += 0.03; break;
        case "spondee.grid.task.v1": altered.fee_bps += 1; break;
        case "spondee.rebalancing.task.v1": altered.reset_latency_seconds += 1; break;
        case "spondee.yield.task.v1": altered.max_risk_score -= 1; break;
      }
      assert.equal(altered.scenario_id, task.scenario_id);
      const response = await fetch(`${base}/v1/activations`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ promise_id: promise.promise_id, task: altered, mode: "SIMULATION" }),
      });
      assert.equal(response.status, 409, `${task.schema} accepted a mutated approved task`);
      const error = await response.json() as { error: string };
      assert.match(error.error, /full user-approved Promise Card/i);
      assert.equal(store.activations.size, 0);
      assert.equal(store.receipts.size, 0);
    }
  });
});

test("blocked live activation cannot be resumed into a wallet/chain write", async () => {
  await withServer(async (base, store) => {
    const task = DEMO_TASKS[0];
    const p = await fetch(`${base}/v1/promises/preview`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const { promise } = await p.json() as { promise: { promise_id: string } };
    const response = await fetch(`${base}/v1/activations`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ promise_id: promise.promise_id, task, mode: "LIVE_TESTNET" }),
    });
    const { activation } = await response.json() as { activation: { activation_id: string; status: string } };
    assert.equal(activation.status, "BLOCKED_LIVE_GATE");
    const again = await fetch(`${base}/v1/activations/${activation.activation_id}/live-testnet`, { method: "POST" });
    assert.equal(again.status, 409);
    assert.equal(store.activations.get(activation.activation_id)?.status, "BLOCKED_LIVE_GATE");
  });
});
