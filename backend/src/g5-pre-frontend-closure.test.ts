import assert from "node:assert/strict";
import test from "node:test";
import {
  G5HealthForwardAgentOutputSchema,
  G5HealthForwardTaskSchema,
  buildG5HealthPromise,
  buildHealthEventTape,
  decodeG5HealthTask,
  encodeG5HealthTask,
  evaluateHealthBaseline,
} from "./g5-health-forward.js";
import {
  G5RebalancingForwardAgentOutputSchema,
  G5RebalancingForwardTaskSchema,
  buildG5RebalancingPromise,
  decodeG5RebalancingTask,
  encodeG5RebalancingTask,
  evaluateRebalancingAgent,
  evaluateRebalancingBaseline,
} from "./g5-rebalancing-forward.js";
import { G5_BNB_USD_FEED } from "./g5-forward-marketplace.js";

const freeze = { round_id: "1000", price_usd: 1000, updated_at: "2026-09-04T10:00:00.000Z", frozen_at: "2026-09-04T10:00:01.000Z" };
const rounds = [
  { round_id: "1001", price_usd: 998, updated_at: "2026-09-04T10:01:00.000Z" },
  { round_id: "1002", price_usd: 1002, updated_at: "2026-09-04T10:02:00.000Z" },
  { round_id: "1003", price_usd: 997, updated_at: "2026-09-04T10:03:00.000Z" },
  { round_id: "1004", price_usd: 1001, updated_at: "2026-09-04T10:04:00.000Z" },
  { round_id: "1005", price_usd: 996, updated_at: "2026-09-04T10:05:00.000Z" },
  { round_id: "1006", price_usd: 1003, updated_at: "2026-09-04T10:06:00.000Z" },
];

test("Health forward task is compact, deterministic and produces a positive precommitted warning lead", () => {
  const task = G5HealthForwardTaskSchema.parse({
    schema: "spondee.health-forward-observed.task.v1",
    scenario_id: "health-test",
    evidence_class: "OBSERVED",
    source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_BNB_USD_FEED, feed_description: "BNB / USD" },
    freeze,
    observation_rule: { only_rounds_after_activation: true, target_future_rounds: 6, max_wait_seconds: 480, poll_seconds: 5 },
    position: { collateral_bnb: 10, debt_usd: (10 * 1000 * 0.8) / 1.08, liquidation_threshold: 0.8, warning_health_factor: 1.2, critical_health_factor: 1.0, baseline_check_every_rounds: 4 },
    claim_guardrail: "Observed BNB/USD monitoring of a frozen hypothetical collateral/debt position. No mainnet value moves and no liquidation-prevention or safety guarantee is claimed.",
  });
  const encoded = encodeG5HealthTask(task);
  assert.ok(Buffer.byteLength(encoded, "utf8") < 1000);
  assert.deepEqual(decodeG5HealthTask(encoded), task);
  assert.equal(buildG5HealthPromise(task).promise_id, buildG5HealthPromise(task).promise_id);
  const baseline = evaluateHealthBaseline(task, rounds);
  assert.equal(baseline.first_check_round_id, "1004");
  const tape = buildHealthEventTape(task, rounds, "2026-09-04T10:00:30.000Z", "2026-09-04T10:00:30.250Z");
  assert.ok(tape.event_tape.warning_lead_time_seconds > 0);
  assert.equal(tape.event_tape.response_latency_ms, 250);
  assert.equal(tape.result.warning_was_actionable_before_baseline_check, true);
  G5HealthForwardAgentOutputSchema.parse({
    schema: "spondee.health-forward-observed-agent-output.v1",
    scenario_id: task.scenario_id,
    observation_started_at: "2026-09-04T10:00:30.000Z",
    observation_completed_at: "2026-09-04T10:06:01.000Z",
    rounds,
    health_path: tape.health_path,
    event_tape: tape.event_tape,
    result: tape.result,
    wallet_used_for_market_data: false,
    mainnet_chain_write_attempted: false,
    liquidation_prevention_claimed: false,
  });
});

test("Rebalancing forward task is compact and compares bounded rebalance to same-window static hold", () => {
  const task = G5RebalancingForwardTaskSchema.parse({
    schema: "spondee.rebalancing-forward-observed.task.v1",
    scenario_id: "reb-test",
    evidence_class: "OBSERVED",
    source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_BNB_USD_FEED, feed_description: "BNB / USD" },
    freeze,
    observation_rule: { only_rounds_after_activation: true, target_future_rounds: 6, max_wait_seconds: 480, poll_seconds: 5 },
    portfolio: { capital_usd: 10000, target_bnb_weight_pct: 50, starting_bnb_weight_pct: 50, rebalance_tolerance_bps: 2, fee_bps: 10, slippage_bps: 5, baseline: "NO_REBALANCE_STATIC_HOLD" },
    claim_guardrail: "Observed BNB/USD paper rebalancing of a frozen hypothetical 50/50 portfolio. No mainnet trade or realized PnL is claimed and negative outcomes remain valid evidence.",
  });
  const encoded = encodeG5RebalancingTask(task);
  assert.ok(Buffer.byteLength(encoded, "utf8") < 1000);
  assert.deepEqual(decodeG5RebalancingTask(encoded), task);
  assert.equal(buildG5RebalancingPromise(task).promise_id, buildG5RebalancingPromise(task).promise_id);
  const agent = evaluateRebalancingAgent(task, rounds);
  const baseline = evaluateRebalancingBaseline(task, rounds);
  assert.ok(agent.rebalance_count >= 0);
  assert.ok(agent.estimated_execution_friction_usd >= 0);
  assert.equal(baseline.estimated_execution_friction_usd, 0);
  G5RebalancingForwardAgentOutputSchema.parse({
    schema: "spondee.rebalancing-forward-observed-agent-output.v1",
    scenario_id: task.scenario_id,
    observation_started_at: "2026-09-04T10:00:30.000Z",
    observation_completed_at: "2026-09-04T10:06:01.000Z",
    rounds,
    strategy_result: agent,
    wallet_used_for_market_data: false,
    mainnet_chain_write_attempted: false,
    realized_mainnet_pnl_claimed: false,
  });
});
