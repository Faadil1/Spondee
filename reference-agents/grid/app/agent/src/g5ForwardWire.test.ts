import test from "node:test";
import assert from "node:assert/strict";
import { G5_GRID_TASK_PREFIX_V2, decodeForwardWireTask } from "./g5ForwardWire.js";

const tuple = [
  "g5-grid-forward-test-001",
  "100",
  700,
  "2026-09-04T06:00:00.000Z",
  "2026-09-04T06:00:05.000Z",
  8,
  480,
  5,
  10000,
  9,
  0.15,
  10,
  5,
];

test("seller reconstructs canonical task from compact V2 carrier", () => {
  const encoded = `${G5_GRID_TASK_PREFIX_V2}${Buffer.from(JSON.stringify(tuple), "utf8").toString("base64url")}`;
  assert.ok(Buffer.byteLength(encoded, "utf8") < 500);
  const task = decodeForwardWireTask(encoded);
  assert.ok(task);
  assert.equal(task.scenario_id, "g5-grid-forward-test-001");
  assert.equal(task.source.chain_id, 56);
  assert.equal(task.evidence_class, "OBSERVED");
  assert.equal(task.observation_rule.target_future_rounds, 8);
  assert.equal(task.strategy.baseline, "STATIC_50_50_BUY_AND_HOLD");
  assert.equal(task.claim_guardrail, "Forward observed-market-data task only. No mainnet trade is executed; paper returns are not realized PnL and do not guarantee future performance.");
});

test("seller rejects malformed compact carrier", () => {
  const encoded = `${G5_GRID_TASK_PREFIX_V2}${Buffer.from(JSON.stringify(["too-short"]), "utf8").toString("base64url")}`;
  assert.equal(decodeForwardWireTask(encoded), null);
});
