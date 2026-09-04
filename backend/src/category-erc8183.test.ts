import assert from "node:assert/strict";
import test from "node:test";
import type { SpondeeTask } from "./contracts.js";
import {
  encodeSpondeeCategoryTask,
  runSignedZeroPriceCategoryTestnetActivation,
  supportsSpondeeLiveTask,
} from "./category-erc8183.js";

const tasks: SpondeeTask[] = [
  {
    schema: "spondee.grid.task.v1",
    scenario_id: "grid-ci",
    evidence_class: "SIMULATION",
    capital_usd: 10000,
    lower_price: 580,
    upper_price: 620,
    levels: 5,
    fee_bps: 10,
    slippage_bps: 5,
    declared_price_path: [
      { at_seconds: 0, price: 600 },
      { at_seconds: 120, price: 610 },
    ],
  },
  {
    schema: "spondee.rebalancing.task.v1",
    scenario_id: "rebalancing-ci",
    evidence_class: "SIMULATION",
    position: { capital_usd: 10000, lower_price: 580, upper_price: 620 },
    target_width_bps: 600,
    reset_latency_seconds: 60,
    estimated_reset_cost_usd: 4,
    declared_price_path: [
      { at_seconds: 0, price: 600 },
      { at_seconds: 120, price: 625 },
    ],
  },
  {
    schema: "spondee.yield.task.v1",
    scenario_id: "yield-ci",
    evidence_class: "SIMULATION",
    capital_usd: 10000,
    horizon_days: 30,
    max_risk_score: 45,
    current: { id: "current", gross_apr_pct: 5, risk_score: 20, switch_cost_usd: 0 },
    candidates: [
      { id: "candidate", gross_apr_pct: 8, risk_score: 35, switch_cost_usd: 2 },
    ],
  },
];

test("multi-category live driver accepts all three G4 task schemas", () => {
  for (const task of tasks) {
    assert.equal(supportsSpondeeLiveTask(task), true);
    const encoded = encodeSpondeeCategoryTask(task);
    assert.match(encoded, /^SPONDEE_TASK_B64_V1:[A-Za-z0-9_-]+$/);
    const decoded = JSON.parse(
      Buffer.from(encoded.slice("SPONDEE_TASK_B64_V1:".length), "base64url").toString("utf8"),
    );
    assert.deepEqual(decoded, task);
  }
});

test("all G4 categories fail closed before wallet/network when live gate is absent", async () => {
  for (const task of tasks) {
    await assert.rejects(
      () => runSignedZeroPriceCategoryTestnetActivation(task, {}),
      /Live testnet gate is closed/i,
    );
  }
});
