import assert from "node:assert/strict";
import test from "node:test";
import type { ActivationRecord } from "./contracts.js";
import { buildPromiseCard } from "./engines.js";
import { DEMO_TASKS } from "./examples.js";
import { MemoryStore } from "./store.js";

function activation(status: ActivationRecord["status"] = "PREPARED"): ActivationRecord {
  const task = DEMO_TASKS[0];
  const promise = buildPromiseCard(task, "spondee-health-factor");
  return {
    activation_id: "sa_approved_health_task",
    agent_id: promise.agent_id,
    category: promise.category,
    promise_id: promise.promise_id,
    scenario_id: promise.scenario_id,
    mode: "LIVE_TESTNET",
    status,
    task,
    promise,
    receipt_id: null,
    chain: { network: "bsc-testnet", job_id: null, tx_hashes: [], deliverable_url: null },
    created_at: new Date("2026-10-10T12:00:00.000Z").toISOString(),
    updated_at: new Date("2026-10-10T12:00:00.000Z").toISOString(),
    failure_reason: null,
  };
}

test("one and only one requester can claim a prepared live activation", async () => {
  const store = new MemoryStore();
  const record = activation();
  await store.putActivation(record);
  const [first, second] = await Promise.all([
    store.claimLiveActivation(record.activation_id),
    store.claimLiveActivation(record.activation_id),
  ]);
  assert.equal(Number(Boolean(first)) + Number(Boolean(second)), 1);
  assert.equal((await store.getActivation(record.activation_id))?.status, "LIVE_IN_FLIGHT");
  assert.equal(await store.claimLiveActivation(record.activation_id), null);
});

test("finalized, unknown-chain, blocked and simulated jobs never become a new live job", async () => {
  for (const status of ["CHAIN_FUNDED", "CHAIN_SUBMITTED", "CHAIN_UNKNOWN", "COMPLETED",
                         "FAILED", "BLOCKED_LIVE_GATE", "SIMULATED"] as const) {
    const store = new MemoryStore();
    await store.putActivation(activation(status));
    assert.equal(await store.claimLiveActivation("sa_approved_health_task"), null, status);
    assert.equal((await store.getActivation("sa_approved_health_task"))?.status, status);
  }
});

test("claim returns a copy and does not mutate signed promise or user task", async () => {
  const store = new MemoryStore();
  await store.putActivation(activation());
  const claimed = await store.claimLiveActivation("sa_approved_health_task");
  assert.ok(claimed);
  assert.equal(claimed.promise.promise_id, claimed.promise_id);
  assert.equal(claimed.task.scenario_id, claimed.scenario_id);
  claimed.chain.job_id = "synthetic_not_a_real_job";
  const durable = await store.getActivation("sa_approved_health_task");
  assert.equal(durable?.chain.job_id, null);
});
