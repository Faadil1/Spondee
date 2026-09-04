import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { DEMO_TASKS } from "./examples.js";
import { MemoryStore } from "./store.js";

async function withServer(
  fn: (base: string) => Promise<void>,
  env: NodeJS.ProcessEnv = {},
) {
  const store = new MemoryStore();
  await store.init();
  const server = createApp(store, env).listen(0);
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

test("frontend bootstrap exposes stable product, four categories and verified Spondee activation proofs", async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/v1/product/bootstrap`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      schema: string;
      product: { name: string; tagline: string; primary_path: string[] };
      categories: Array<{ reference_agent: { readiness: string; activatable: boolean; activation_proof: { status: string; job_id: string | null } } }>;
      backend_capabilities: { first_countable_observed_grid_pair: string; observed_pair_requirement: string };
      endpoints: Record<string, string>;
    };
    assert.equal(body.schema, "spondee.frontend-bootstrap.v1");
    assert.equal(body.product.name, "Spondee");
    assert.equal(body.product.tagline, "Agents, measured by what they deliver.");
    assert.equal(body.categories.length, 4);
    assert.deepEqual(body.categories.map((entry) => entry.reference_agent.activation_proof.job_id), ["949", "954", "955", "957"]);
    assert.ok(body.categories.every((entry) => entry.reference_agent.readiness === "LIVE_TESTNET_VERIFIED"));
    assert.ok(body.categories.every((entry) => entry.reference_agent.activatable === true));
    assert.ok(body.categories.every((entry) => entry.reference_agent.activation_proof.status === "VERIFIED_LIVE_TESTNET"));
    assert.equal(body.backend_capabilities.first_countable_observed_grid_pair, "VERIFIED_JOB_962");
    assert.equal(body.backend_capabilities.observed_pair_requirement, "PARTIAL_1_OF_3");
    assert.equal(body.endpoints.receipts, "/v1/receipts");
  });
});

test("frontend list endpoints expose Promise, activation and receipt records", async () => {
  await withServer(async (base) => {
    const task = DEMO_TASKS[0]!;
    const previewResponse = await fetch(`${base}/v1/promises/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task }),
    });
    assert.equal(previewResponse.status, 201);
    const preview = await previewResponse.json() as { promise: { promise_id: string } };

    const activationResponse = await fetch(`${base}/v1/activations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promise_id: preview.promise.promise_id, task, mode: "SIMULATION" }),
    });
    assert.equal(activationResponse.status, 201);

    const promises = await (await fetch(`${base}/v1/promises`)).json() as { promises: unknown[] };
    const activations = await (await fetch(`${base}/v1/activations`)).json() as { activations: unknown[] };
    const receipts = await (await fetch(`${base}/v1/receipts`)).json() as { receipts: unknown[] };
    const evidence = await (await fetch(`${base}/v1/evidence/runs`)).json() as { evidence: unknown[] };
    assert.equal(promises.promises.length, 1);
    assert.equal(activations.activations.length, 1);
    assert.equal(receipts.receipts.length, 1);
    assert.equal(evidence.evidence.length, 0);
  });
});

test("CORS is explicit allowlist rather than wildcard", async () => {
  await withServer(async (base) => {
    const allowed = await fetch(`${base}/v1/product/bootstrap`, {
      method: "OPTIONS",
      headers: { origin: "https://frontend.example" },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://frontend.example");

    const blocked = await fetch(`${base}/v1/product/bootstrap`, {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    });
    assert.equal(blocked.status, 403);
    assert.notEqual(blocked.headers.get("access-control-allow-origin"), "*");
  }, { SPONDEE_CORS_ORIGINS: "https://frontend.example" });
});
