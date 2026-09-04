import test from "node:test";
import assert from "node:assert/strict";
import {
  G5_GRID_FEED,
  G5_GRID_TASK_PREFIX,
  buildForwardPromise,
  commitmentForPromise,
  decodeForwardTask,
  evaluateForwardGrid,
} from "./g5ForwardObserved.js";

function encodedTask() {
  const task = {
    schema: "spondee.grid-forward-observed.task.v1",
    scenario_id: "g5-grid-forward-seller-test",
    evidence_class: "OBSERVED",
    source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_GRID_FEED, feed_description: "BNB / USD" },
    freeze: { round_id: "100", price_usd: 700, updated_at: "2026-09-04T06:00:00.000Z", frozen_at: "2026-09-04T06:00:05.000Z" },
    observation_rule: { only_rounds_after_activation: true, target_future_rounds: 5, max_wait_seconds: 300, poll_seconds: 5 },
    strategy: { capital_usd: 10000, starting_allocation: "50% USD / 50% BNB", levels: 9, half_width_pct: 0.15, fee_bps: 10, slippage_bps: 5, baseline: "STATIC_50_50_BUY_AND_HOLD" },
    claim_guardrail: "Forward observed-market-data task only. No mainnet trade is executed; paper returns are not realized PnL and do not guarantee future performance.",
  };
  return `${G5_GRID_TASK_PREFIX}${Buffer.from(JSON.stringify(task), "utf8").toString("base64url")}`;
}

test("seller decodes only the dedicated G5 forward task", () => {
  const task = decodeForwardTask(encodedTask());
  assert.ok(task);
  assert.equal(task.schema, "spondee.grid-forward-observed.task.v1");
  assert.equal(decodeForwardTask("SPONDEE_TASK_B64_V1:abc"), null);
});

test("seller Promise is deterministic and zero-price commitment binds it", () => {
  const task = decodeForwardTask(encodedTask())!;
  const a = buildForwardPromise(task, "0");
  const b = buildForwardPromise(task, "0");
  assert.deepEqual(a, b);
  const commitment = commitmentForPromise(a);
  assert.equal(commitment.promise_id, a.promise_id);
  assert.equal(commitment.price_raw, "0");
  assert.match(commitment.promise_sha256, /^[0-9a-f]{64}$/);
});

test("seller evaluates only a sufficiently long future round set", () => {
  const task = decodeForwardTask(encodedTask())!;
  const rounds = [
    { round_id: "101", price_usd: 700.4, updated_at: "2026-09-04T06:01:00.000Z" },
    { round_id: "102", price_usd: 699.3, updated_at: "2026-09-04T06:01:30.000Z" },
    { round_id: "103", price_usd: 701.2, updated_at: "2026-09-04T06:02:00.000Z" },
    { round_id: "104", price_usd: 700.1, updated_at: "2026-09-04T06:02:30.000Z" },
    { round_id: "105", price_usd: 702.0, updated_at: "2026-09-04T06:03:00.000Z" },
  ];
  const result = evaluateForwardGrid(task, rounds);
  assert.equal(result.initial_equity_usd, 10000);
  assert.equal(result.parameters.no_lookahead_configuration, true);
  assert.ok(Number.isFinite(result.net_return_pct));
  assert.throws(() => evaluateForwardGrid(task, rounds.slice(0, 4)), /insufficient forward rounds/);
});
