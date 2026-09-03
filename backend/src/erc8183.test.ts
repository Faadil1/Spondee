import assert from "node:assert/strict";
import test from "node:test";
import { buildJobDescription } from "@bnbagent/sdk/erc8183";
import {
  BSC_TESTNET,
  SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES,
  encodeSpondeeHealthFactorTask,
  hashSpondeePromise,
  liveGateStatus,
  signedSpondeePromiseCommitmentFromQuote,
  validateLiveSpondeeReceipt,
  validatePreviewPromise,
  validatePromiseAgainstCommitment,
  validateSignedQuoteEnvelope,
  type SignedQuote,
} from "./erc8183.js";

const liveTask = {
  schema: "spondee.health-factor.task.v1" as const,
  scenario_id: "spondee-hf-demo-001",
  evidence_class: "SIMULATION" as const,
  position: {
    collateral_usd: 2000,
    debt_usd: 1000,
    liquidation_threshold: 0.8,
  },
  hf_floor: 1.2,
  desired_warning_lead_seconds: 120,
  stress_path: [
    { at_seconds: 0, collateral_multiplier: 1, debt_multiplier: 1 },
    { at_seconds: 300, collateral_multiplier: 0.9, debt_multiplier: 1 },
    { at_seconds: 600, collateral_multiplier: 0.7, debt_multiplier: 1 },
  ],
};

const promise = {
  schema: "spondee.promise-card.v1",
  category: "Health Factor Monitoring",
  promise_id: "sp_87c1d19f5bc0cda01d586131",
  scenario_id: "spondee-hf-demo-001",
  evidence_class: "SIMULATION",
  expected_outcome:
    "Issue a warning 120s before the declared HF floor crossing in scenario spondee-hf-demo-001.",
  confidence: null,
  confidence_status: "UNSCORED_UNTIL_OBSERVED_CALIBRATION",
  expected_downside: {
    breach_projected: true,
    minimum_projected_hf: 1.12,
    hf_floor: 1.2,
  },
  expected_cost: {
    currency: "raw_erc8183_wei",
    amount: "0",
    source: "fixed_studio_list_price",
  },
  timing: {
    predicted_floor_crossing_seconds: 525,
    expected_warning_issued_seconds: 405,
    expected_warning_lead_seconds: 120,
  },
  methodology: {
    model: "deterministic_declared_stress_path",
    interpolation: "linear_between_declared_points",
    calibration_history: "INSUFFICIENT_HISTORY",
  },
  claim_guardrail:
    "Simulation only. This Promise Card is not an observed performance claim and does not guarantee liquidation prevention.",
};

function commitmentCarrier(p = promise): string {
  return `SPONDEE_PROMISE_COMMITMENT_V1:${JSON.stringify({
    p: p.promise_id,
    s: p.scenario_id,
    r: p.expected_cost.amount,
    h: hashSpondeePromise(p),
  })}`;
}

function quoteFixture(opts: {
  requestCriteria?: unknown;
  responseCriteria?: unknown;
  taskDescription?: string;
} = {}): SignedQuote {
  const carrier = commitmentCarrier();
  return validateSignedQuoteEnvelope({
    request: {
      task_description: opts.taskDescription ?? "health factor task",
      terms: {
        deliverables: "Spondee Outcome Receipt",
        quality_standards: "Committed Spondee Promise; SIMULATION only",
        success_criteria: opts.requestCriteria ?? [carrier],
      },
    },
    request_hash: `0x${"1".repeat(64)}`,
    response: {
      accepted: true,
      quote_expires_at: 1788478578,
      terms: {
        deliverables: "Spondee Outcome Receipt",
        quality_standards: "Committed Spondee Promise; SIMULATION only",
        success_criteria: opts.responseCriteria ?? [carrier],
        price: "0",
        currency: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
      },
    },
    response_hash: `0x${"2".repeat(64)}`,
    negotiation_hash: `0x${"3".repeat(64)}`,
    provider_sig: `0x${"4".repeat(130)}`,
    chain_id: 97,
    verifying_contract: BSC_TESTNET.commerce,
  });
}

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

test("Health Factor task is encoded into a sanitizer-safe chain carrier", () => {
  const encoded = encodeSpondeeHealthFactorTask(liveTask);
  assert.match(encoded, /^SPONDEE_TASK_B64_V1:[A-Za-z0-9_-]+$/);
  assert.equal(encoded.includes("["), false);
  assert.equal(encoded.includes("]"), false);
  const decoded = JSON.parse(
    Buffer.from(encoded.slice("SPONDEE_TASK_B64_V1:".length), "base64url").toString("utf8"),
  );
  assert.deepEqual(decoded, liveTask);
});

test("official BNB NegotiationResult envelope is accepted without provider_address", () => {
  const quote = quoteFixture();
  assert.equal(quote.response.accepted, true);
  assert.equal(quote.response.terms.price, "0");
  assert.equal("provider_address" in quote, false);
});

test("Spondee Promise commitment is recovered from exact request/response success_criteria", () => {
  const recovered = signedSpondeePromiseCommitmentFromQuote(quoteFixture());
  assert.equal(recovered.promise_id, promise.promise_id);
  assert.equal(recovered.scenario_id, promise.scenario_id);
  assert.equal(recovered.price_raw, "0");
  assert.equal(recovered.promise_sha256, hashSpondeePromise(promise));
});

test("read-only Promise preview is bound exactly to the signed compact commitment", () => {
  const preview = validatePreviewPromise(promise, liveTask.scenario_id);
  const commitment = signedSpondeePromiseCommitmentFromQuote(quoteFixture());
  assert.doesNotThrow(() => validatePromiseAgainstCommitment(preview, commitment));
});

test("tampered preview Promise fails the signed commitment check", () => {
  const commitment = signedSpondeePromiseCommitmentFromQuote(quoteFixture());
  assert.throws(
    () =>
      validatePromiseAgainstCommitment(
        { ...promise, expected_outcome: "tampered" },
        commitment,
      ),
    /hash does not match/i,
  );
});

test("missing signed Spondee Promise commitment fails closed", () => {
  assert.throws(
    () =>
      signedSpondeePromiseCommitmentFromQuote(
        quoteFixture({ requestCriteria: [], responseCriteria: [commitmentCarrier()] }),
      ),
    /request.*exactly one Spondee Promise commitment/i,
  );
});

test("duplicate signed Spondee Promise commitments fail closed", () => {
  const carrier = commitmentCarrier();
  assert.throws(
    () =>
      signedSpondeePromiseCommitmentFromQuote(
        quoteFixture({ requestCriteria: [carrier, carrier], responseCriteria: [carrier] }),
      ),
    /found 2/i,
  );
});

test("request and response Spondee Promise commitments must match exactly", () => {
  const other = {
    ...promise,
    promise_id: "sp_other",
  };
  assert.throws(
    () =>
      signedSpondeePromiseCommitmentFromQuote(
        quoteFixture({
          requestCriteria: [commitmentCarrier()],
          responseCriteria: [commitmentCarrier(other)],
        }),
      ),
    /do not match/i,
  );
});

test("representative live JobDescription stays inside the conservative MegaFuel byte budget", () => {
  const taskDescription = encodeSpondeeHealthFactorTask(liveTask);
  const description = buildJobDescription(
    quoteFixture({ taskDescription }),
    SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES,
  );
  const bytes = Buffer.byteLength(description, "utf8");
  assert.ok(
    bytes <= SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES,
    `${bytes} > ${SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES}`,
  );
  const parsed = JSON.parse(description) as Record<string, unknown>;
  assert.equal(parsed.task, taskDescription);
  assert.ok(bytes < 1600);
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

test("live deliverable validation accepts only the committed simulation receipt", () => {
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
