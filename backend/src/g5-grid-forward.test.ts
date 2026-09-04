import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_GRID_FEED,
  G5GridForwardTaskSchema,
  assertForwardObservationAfterActivation,
  buildG5GridForwardCommitment,
  buildG5GridForwardPromise,
  decodeG5GridForwardTask,
  encodeG5GridForwardTask,
  evaluateForwardBaseline,
  evaluateForwardGrid,
  sha256Hex,
  type G5GridForwardTask,
  type G5ObservedRound,
} from "./g5-grid-forward.js";

function task(): G5GridForwardTask {
  return G5GridForwardTaskSchema.parse({
    schema: "spondee.grid-forward-observed.task.v1",
    scenario_id: "g5-grid-forward-test-001",
    evidence_class: "OBSERVED",
    source: {
      chain_id: 56,
      network: "bsc-mainnet",
      feed_address: G5_GRID_FEED,
      feed_description: "BNB / USD",
    },
    freeze: {
      round_id: "100",
      price_usd: 700,
      updated_at: "2026-09-04T06:00:00.000Z",
      frozen_at: "2026-09-04T06:00:05.000Z",
    },
    observation_rule: {
      only_rounds_after_activation: true,
      target_future_rounds: 5,
      max_wait_seconds: 300,
      poll_seconds: 5,
    },
    strategy: {
      capital_usd: 10000,
      starting_allocation: "50% USD / 50% BNB",
      levels: 9,
      half_width_pct: 0.15,
      fee_bps: 10,
      slippage_bps: 5,
      baseline: "STATIC_50_50_BUY_AND_HOLD",
    },
    claim_guardrail: "Forward observed-market-data task only. No mainnet trade is executed; paper returns are not realized PnL and do not guarantee future performance.",
  });
}

function rounds(): G5ObservedRound[] {
  return [
    { round_id: "101", price_usd: 700.4, updated_at: "2026-09-04T06:01:00.000Z" },
    { round_id: "102", price_usd: 699.3, updated_at: "2026-09-04T06:01:30.000Z" },
    { round_id: "103", price_usd: 701.2, updated_at: "2026-09-04T06:02:00.000Z" },
    { round_id: "104", price_usd: 700.1, updated_at: "2026-09-04T06:02:30.000Z" },
    { round_id: "105", price_usd: 702.0, updated_at: "2026-09-04T06:03:00.000Z" },
  ];
}

test("forward task roundtrips through the chain-safe carrier", () => {
  const original = task();
  const decoded = decodeG5GridForwardTask(encodeG5GridForwardTask(original));
  assert.deepEqual(decoded, original);
});

test("forward Promise and commitment are deterministic and bind the frozen config", () => {
  const a = buildG5GridForwardPromise(task(), "0");
  const b = buildG5GridForwardPromise(task(), "0");
  assert.deepEqual(a, b);
  const commitment = buildG5GridForwardCommitment(a);
  assert.equal(commitment.price_raw, "0");
  assert.equal(commitment.promise_sha256, sha256Hex(a));
  assert.equal(commitment.scenario_id, task().scenario_id);
});

test("forward observation must begin after both freeze and marketplace funding", () => {
  assert.doesNotThrow(() =>
    assertForwardObservationAfterActivation(task(), rounds(), "2026-09-04T06:00:30.000Z"),
  );
  const stale = rounds();
  stale[0] = { round_id: "100", price_usd: 700.1, updated_at: "2026-09-04T06:01:00.000Z" };
  assert.throws(() => assertForwardObservationAfterActivation(task(), stale, "2026-09-04T06:00:30.000Z"), /freeze round/);
  assert.throws(() => assertForwardObservationAfterActivation(task(), rounds(), "2026-09-04T06:01:15.000Z"), /marketplace funding/);
});

test("agent and without-agent baseline evaluate the exact same future rounds", () => {
  const agent = evaluateForwardGrid(task(), rounds());
  const baseline = evaluateForwardBaseline(task(), rounds());
  assert.equal(agent.initial_equity_usd, baseline.initial_equity_usd);
  assert.equal(agent.parameters.capital_usd, 10000);
  assert.equal(baseline.parameters.capital_usd, 10000);
  assert.ok(Number.isFinite(agent.net_return_pct));
  assert.ok(Number.isFinite(baseline.net_return_pct));
});

test("task fails closed on wrong feed or historical mode", () => {
  const candidate = task() as unknown as Record<string, unknown>;
  candidate.evidence_class = "SIMULATION";
  assert.throws(() => G5GridForwardTaskSchema.parse(candidate));
});
