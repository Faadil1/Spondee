import assert from "node:assert/strict";
import test from "node:test";
import {
  BSC_TESTNET,
  liveGateStatus,
  validateLiveSpondeeReceipt,
  validateSignedQuoteEnvelope,
} from "./erc8183.js";

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

test("official BNB NegotiationResult envelope is accepted without provider_address", () => {
  const quote = validateSignedQuoteEnvelope({
    request: {
      task_description: "health factor task",
      terms: {
        deliverables: "Spondee Outcome Receipt",
        quality_standards: "preserve promise",
        spondee_promise: {
          schema: "spondee.promise-card.v1",
          promise_id: "sp_test",
          scenario_id: "scenario-test",
        },
      },
    },
    request_hash: "0xrequest",
    response: {
      accepted: true,
      terms: {
        deliverables: "Spondee Outcome Receipt",
        quality_standards: "preserve promise",
        price: "0",
        currency: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
      },
    },
    response_hash: "0xresponse",
    negotiation_hash: "0xnegotiation",
    provider_sig: "0xsignature",
    chain_id: 97,
    verifying_contract: BSC_TESTNET.commerce,
  });

  assert.equal(quote.response.accepted, true);
  assert.equal(quote.response.terms.price, "0");
  assert.equal("provider_address" in quote, false);
});

test("accepted quote without provider signature fails closed", () => {
  assert.throws(
    () =>
      validateSignedQuoteEnvelope({
        request: { terms: {} },
        response: { accepted: true, terms: { price: "0" } },
        negotiation_hash: "0xnegotiation",
      }),
    /provider_sig/i,
  );
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
