import assert from "node:assert/strict";
import test from "node:test";
import { BSC_TESTNET, liveGateStatus, validateLiveSpondeeReceipt } from "./erc8183.js";

test("live ERC-8183 execution is disabled by default", () => {
  const gate = liveGateStatus({});
  assert.equal(gate.enabled, false);
  assert.equal(gate.ready_for_live_write, false);
});

test("even an enable flag alone cannot open the live gate", () => {
  const gate = liveGateStatus({ SPONDEE_LIVE_TESTNET_ENABLED: "true" });
  assert.equal(gate.enabled, true);
  assert.equal(gate.ready_for_live_write, false);
});

test("BSC testnet contract anchors are explicit and chain id is 97", () => {
  assert.equal(BSC_TESTNET.chainId, 97);
  for (const address of [
    BSC_TESTNET.identityRegistry,
    BSC_TESTNET.commerce,
    BSC_TESTNET.evaluatorRouter,
    BSC_TESTNET.optimisticPolicy,
  ]) {
    assert.match(address, /^0x[a-fA-F0-9]{40}$/);
  }
});

test("live deliverable validation accepts only the signed simulation receipt", () => {
  const receipt = validateLiveSpondeeReceipt(
    {
      schema: "spondee.outcome-receipt.v1",
      promise_id: "sp_test",
      scenario_id: "scenario-test",
      evidence_class: "SIMULATION",
      outcome: { useful_lead_seconds: 120 },
      calibration: {
        eligible_for_observed_agent_advantage: false,
        status: "NOT_OBSERVED_MARKET_EVIDENCE",
      },
    },
    "sp_test",
    "scenario-test",
  );
  assert.equal(receipt.promise_id, "sp_test");
});

test("live deliverable validation rejects a Promise mismatch", () => {
  assert.throws(
    () =>
      validateLiveSpondeeReceipt(
        {
          schema: "spondee.outcome-receipt.v1",
          promise_id: "sp_other",
          scenario_id: "scenario-test",
          evidence_class: "SIMULATION",
          calibration: { eligible_for_observed_agent_advantage: false },
        },
        "sp_expected",
        "scenario-test",
      ),
    /promise_id does not match/i,
  );
});

test("live deliverable validation refuses to upgrade simulation into observed evidence", () => {
  assert.throws(
    () =>
      validateLiveSpondeeReceipt(
        {
          schema: "spondee.outcome-receipt.v1",
          promise_id: "sp_test",
          scenario_id: "scenario-test",
          evidence_class: "OBSERVED",
          calibration: { eligible_for_observed_agent_advantage: true },
        },
        "sp_test",
        "scenario-test",
      ),
    /must remain SIMULATION/i,
  );
});
