import test from "node:test";
import assert from "node:assert/strict";
import { sha256Evidence } from "./observed-evidence.js";
import {
  buildForwardPlan,
  buildMarketplaceTask,
  buildCountableForwardBundle,
  validateActivationForPlan,
  type ForwardRound,
} from "./g5-grid-forward-observed.js";

const anchor: ForwardRound = {
  round_id: "55340232221132060000",
  price_usd: 724.25,
  updated_at: "2026-09-04T10:00:00.000Z",
};

function activation(plan: ReturnType<typeof buildForwardPlan>) {
  return {
    category: "grid",
    network: "bsc-testnet",
    started_at: "2026-09-04T10:00:10.000Z",
    completed_at: "2026-09-04T10:00:40.000Z",
    task_schema: "spondee.grid.task.v1",
    scenario_id: plan.scenario_id,
    service_price_raw: "0",
    result: {
      job_id: "1001",
      promise_id: "sp_forward_grid_test",
      promise_sha256: "a".repeat(64),
      status: "SUBMITTED",
      transactions: {
        create_job: `0x${"1".repeat(64)}`,
        register_job: `0x${"2".repeat(64)}`,
        set_budget: `0x${"3".repeat(64)}`,
        fund: `0x${"4".repeat(64)}`,
        submit: `0x${"5".repeat(64)}`,
      },
      deliverable: { manifest_hash_verified: true, spondee_receipt_verified: true },
    },
  };
}

function rounds(): ForwardRound[] {
  return Array.from({ length: 12 }, (_, i) => ({
    round_id: String(55340232221132060001n + BigInt(i)),
    price_usd: 724.25 + [0.05, -0.08, 0.12, -0.14, 0.19, -0.21, 0.11, -0.04, 0.09, -0.07, 0.13, -0.02][i]!,
    updated_at: new Date(Date.parse("2026-09-04T10:01:00.000Z") + i * 30_000).toISOString(),
  }));
}

function artifacts() {
  const make = (name: string) => ({ uri: `file:///${name}.json`, sha256: sha256Evidence(name) });
  return {
    input: make("input"),
    market: make("market"),
    agent: make("agent"),
    baseline: make("baseline"),
    timing: make("timing"),
    cost: make("cost"),
    tx: make("tx"),
  };
}

test("forward plan freezes grid configuration from anchor only", () => {
  const plan = buildForwardPlan(anchor, "2026-09-04T10:00:05.000Z");
  const task = buildMarketplaceTask(plan);
  assert.equal(task.scenario_id, plan.scenario_id);
  assert.equal(task.evidence_class, "SIMULATION");
  assert.equal(task.declared_price_path.length, 2);
  assert.equal(task.declared_price_path[0]!.price, anchor.price_usd);
  assert.equal(task.declared_price_path[1]!.price, anchor.price_usd);
  assert.equal(plan.countable_before_execution, false);
  assert.equal(plan.chain_write_attempted, false);
});

test("activation must bind exact frozen scenario and zero-price marketplace path", () => {
  const plan = buildForwardPlan(anchor, "2026-09-04T10:00:05.000Z");
  const good = activation(plan);
  assert.equal(validateActivationForPlan(plan, good).result.job_id, "1001");
  assert.throws(() => validateActivationForPlan(plan, { ...good, scenario_id: "wrong" }), /scenario/);
  assert.throws(() => validateActivationForPlan(plan, { ...good, service_price_raw: "1" }), /zero-price/);
});

test("countable forward Grid bundle requires all rounds after activation completion", () => {
  const plan = buildForwardPlan(anchor, "2026-09-04T10:00:05.000Z");
  const good = activation(plan);
  const bundle = buildCountableForwardBundle(plan, good, rounds(), 0.2, 0.01, artifacts());
  assert.equal(bundle.marketplace_hire.countable_for_final_report, true);
  assert.equal(bundle.marketplace_hire.mode, "LIVE_BSC_TESTNET_MARKETPLACE");
  assert.equal(bundle.observation_mode, "LIVE_PUBLIC_DATA_TASK");
  assert.match(bundle.marketplace_hire.activation_reference!, /job:1001/);
  assert.ok(bundle.artifacts.some((x) => x.kind === "TRANSACTION_TAPE"));
});

test("pre-activation market data fails closed", () => {
  const plan = buildForwardPlan(anchor, "2026-09-04T10:00:05.000Z");
  const badRounds = rounds();
  badRounds[0] = { ...badRounds[0]!, updated_at: "2026-09-04T10:00:20.000Z" };
  assert.throws(() => buildCountableForwardBundle(plan, activation(plan), badRounds, 0.2, 0.01, artifacts()), /strictly after marketplace activation completion/);
});
