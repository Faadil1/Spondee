import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { DEMO_TASKS } from "./examples.js";
import { MemoryStore } from "./store.js";

async function withServer(fn: (base: string) => Promise<void>) {
  const store = new MemoryStore();
  await store.init();
  const server = createApp(store).listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
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
