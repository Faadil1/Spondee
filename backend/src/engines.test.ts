import assert from "node:assert/strict";
import test from "node:test";
import { referenceAgentForCategory } from "./catalog.js";
import { DEMO_TASKS } from "./examples.js";
import { buildPromiseCard, buildSimulationReceipt, taskCategory } from "./engines.js";

const now = new Date("2026-09-03T20:00:00.000Z");

test("all four BNB categories produce guarded zero-price Promise Cards and simulation receipts", () => {
  const seen = new Set<string>();
  for (const task of DEMO_TASKS) {
    const category = taskCategory(task);
    seen.add(category);
    const agent = referenceAgentForCategory(category);
    const promise = buildPromiseCard(task, agent.agent_id, agent.version, 0n, now);
    const receipt = buildSimulationReceipt(task, promise, now);

    assert.equal(promise.category, category);
    assert.equal(promise.confidence, null);
    assert.equal(promise.confidence_status, "UNSCORED_UNTIL_OBSERVED_CALIBRATION");
    assert.equal(promise.expected_cost.amount, "0");
    assert.equal(promise.evidence_class, "SIMULATION");
    assert.equal(receipt.promise_id, promise.promise_id);
    assert.equal(receipt.scenario_id, task.scenario_id);
    assert.equal(receipt.evidence_class, "SIMULATION");
    assert.equal(receipt.calibration.eligible_for_observed_agent_advantage, false);
    assert.deepEqual(receipt.tx_hashes, []);
  }
  assert.deepEqual(
    [...seen].sort(),
    ["Grid Trading", "Health Factor Monitoring", "Rebalancing", "Yield Optimisation"].sort(),
  );
});

test("Health Factor preserves the 120-second Intervention Advantage demo lead", () => {
  const task = DEMO_TASKS.find((t) => t.schema === "spondee.health-factor.task.v1")!;
  const promise = buildPromiseCard(task, "spondee-health-factor", "0.1.0", 0n, now);
  assert.equal(promise.timing.expected_warning_lead_seconds, 120);
  assert.equal(promise.timing.predicted_floor_crossing_seconds, 525);
});

test("Grid engine surfaces range break without manufacturing PnL", () => {
  const task = DEMO_TASKS.find((t) => t.schema === "spondee.grid.task.v1")!;
  const promise = buildPromiseCard(task, "spondee-grid", "0.1.0", 0n, now);
  assert.equal(promise.expected_downside.no_pnl_guarantee, true);
  assert.equal(typeof promise.timing.projected_range_break_seconds, "number");
  assert.match(promise.expected_outcome, /no profit is promised/i);
});

test("Rebalancing engine emits bounded reset timing and declared cost", () => {
  const task = DEMO_TASKS.find((t) => t.schema === "spondee.rebalancing.task.v1")!;
  const promise = buildPromiseCard(task, "spondee-rebalancing", "0.1.0", 0n, now);
  assert.equal(promise.expected_downside.estimated_reset_cost_usd, 2.5);
  assert.equal(
    Number(promise.timing.projected_reset_seconds) - Number(promise.timing.first_out_of_range_seconds),
    45,
  );
});

test("Yield engine rejects the higher-APR candidate when it violates the declared risk ceiling", () => {
  const task = DEMO_TASKS.find((t) => t.schema === "spondee.yield.task.v1")!;
  const promise = buildPromiseCard(task, "spondee-yield", "0.1.0", 0n, now);
  const receipt = buildSimulationReceipt(task, promise, now);
  assert.equal(receipt.actual_outcome.selected_option_id, "candidate-a");
  assert.equal(receipt.actual_outcome.eligible_candidate_count, 1);
  assert.equal(promise.expected_downside.yield_not_guaranteed, true);
});
