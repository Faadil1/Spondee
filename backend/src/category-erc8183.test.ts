import assert from "node:assert/strict";
import test from "node:test";
import type { SpondeeTask } from "./contracts.js";
import {
  boundedNotifyFundedPayload,
  encodeSpondeeCategoryTask,
  parseNotifyFundedSubmit,
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

test("bounded local proof explicitly opts into synchronous notify result", () => {
  assert.deepEqual(boundedNotifyFundedPayload(955n), {
    skill: "notify_funded",
    job_id: 955,
    wait_for_result: true,
  });
});

test("bounded synchronous seller result yields the exact provider submit transaction", () => {
  const parsed = parseNotifyFundedSubmit(
    {
      ok: true,
      job_id: 955,
      tx_hash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      deliverable_url: "http://127.0.0.1:9100/erc8183/job/955/response",
    },
    955n,
  );
  assert.equal(
    parsed.transactionHash,
    "0x1111111111111111111111111111111111111111111111111111111111111111",
  );
  assert.equal(parsed.deliverableUrl, "http://127.0.0.1:9100/erc8183/job/955/response");
});

test("default asynchronous notify ACK is never mistaken for a terminal submit result", () => {
  assert.throws(
    () => parseNotifyFundedSubmit({ status: "accepted", job_id: 955 }, 955n),
    /did not return ok=true/i,
  );
});

test("bounded synchronous result fails closed on wrong job or malformed tx", () => {
  assert.throws(
    () => parseNotifyFundedSubmit({ ok: true, job_id: 956, tx_hash: `0x${"1".repeat(64)}` }, 955n),
    /wrong job id/i,
  );
  assert.throws(
    () => parseNotifyFundedSubmit({ ok: true, job_id: 955, tx_hash: "0x1234" }, 955n),
    /valid submit transaction hash/i,
  );
});
