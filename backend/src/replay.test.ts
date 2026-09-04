import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_TASKS } from "./examples.js";
import { buildPromiseCard, buildSimulationReceipt } from "./engines.js";
import { buildDecisionReplay } from "./replay.js";
import type { ActivationRecord } from "./contracts.js";

test("Decision Replay reconstructs preserved state without re-execution", () => {
  const task = DEMO_TASKS[0]!;
  const promise = buildPromiseCard(task, "spondee-health-factor", "0.1.0", 0n);
  const receipt = buildSimulationReceipt(task, promise);
  const activation: ActivationRecord = {
    activation_id: "sa_replay_test",
    agent_id: promise.agent_id,
    category: promise.category,
    promise_id: promise.promise_id,
    scenario_id: promise.scenario_id,
    mode: "SIMULATION",
    status: "SIMULATED",
    task,
    promise,
    receipt_id: receipt.receipt_id,
    chain: { network: null, job_id: null, tx_hashes: [], deliverable_url: null },
    created_at: promise.created_at,
    updated_at: receipt.created_at,
    failure_reason: null,
  };

  const replay = buildDecisionReplay(activation, receipt);
  assert.equal(replay.schema, "spondee.decision-replay.v1");
  assert.equal(replay.replay_mode, "READ_ONLY_RECONSTRUCTION");
  assert.equal(replay.truth.reexecution_performed, false);
  assert.equal(replay.truth.receipt_evidence_class, "SIMULATION");
  assert.equal(replay.truth.observed_agent_advantage_eligible, false);
  assert.equal(replay.promise.promise_id, promise.promise_id);
  assert.equal(replay.outcome?.receipt_id, receipt.receipt_id);
});
