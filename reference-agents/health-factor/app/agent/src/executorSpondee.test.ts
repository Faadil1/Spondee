import assert from "node:assert/strict";
import test from "node:test";
import { SellerAgentExecutor } from "./executor.js";
import type { SigningApi } from "./sellerCore.js";

const task = {
  schema: "spondee.health-factor.task.v1",
  scenario_id: "executor-preview-001",
  evidence_class: "SIMULATION",
  position: {
    collateral_usd: 2000,
    debt_usd: 1000,
    liquidation_threshold: 0.8,
  },
  hf_floor: 1.2,
  desired_warning_lead_seconds: 120,
  stress_path: [
    { at_seconds: 0, collateral_multiplier: 1 },
    { at_seconds: 600, collateral_multiplier: 0.7 },
  ],
};

const signing: SigningApi = {
  listPrice: () => 0n,
  clampPrice: (value) => value,
  signQuote: async () => ({ accepted: true }),
  verifySignedJob: async () => ({ ok: true, reason: "test", permanent: false }),
  jobSpec: async () => null,
  submitResult: async () => ({ submitTx: "0xtest", deliverableUrl: null }),
};

function executor(): SellerAgentExecutor {
  return new SellerAgentExecutor({
    runWork: async () => "unused",
    generator: "spondee-test",
    network: "bsc-testnet",
    commerceSkills: true,
    signing,
    pendingJobs: async () => ({ jobs: [] }),
  });
}

test("real SellerAgentExecutor dispatch exposes the free Promise Card skill", async () => {
  const result = await executor().dispatch({
    skill: "preview_health_factor",
    task,
  });

  assert.equal(result.status, "ok");
  const promise = result.promise as Record<string, unknown>;
  assert.equal(promise.schema, "spondee.promise-card.v1");
  assert.equal(promise.scenario_id, "executor-preview-001");
  assert.equal(promise.confidence, null);
  assert.equal(promise.confidence_status, "UNSCORED_UNTIL_OBSERVED_CALIBRATION");
});

test("executor advertises preview alongside the generated ERC-8183 skills", () => {
  assert.deepEqual(executor().skills(), [
    "preview_health_factor",
    "negotiate",
    "notify_funded",
  ]);
});
