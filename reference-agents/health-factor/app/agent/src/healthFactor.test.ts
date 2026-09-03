import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHealthFactorOutcomeFromWorkPrompt,
  buildHealthFactorPromise,
  buildHealthFactorPromiseCommitment,
  decodeHealthFactorPromiseCommitmentCriterion,
  encodeHealthFactorPromiseCommitmentCriterion,
  encodeHealthFactorTaskForChain,
  enrichHealthFactorNegotiation,
  hashHealthFactorPromise,
  HealthFactorTaskSchema,
  parseHealthFactorTask,
  SPONDEE_PROMISE_COMMITMENT_PREFIX,
} from "./healthFactor.js";

const task = HealthFactorTaskSchema.parse({
  schema: "spondee.health-factor.task.v1",
  scenario_id: "hf-demo-001",
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
    { at_seconds: 300, collateral_multiplier: 0.9 },
    { at_seconds: 600, collateral_multiplier: 0.7 },
  ],
});

function decodeCommitment(criteria: unknown) {
  assert.ok(Array.isArray(criteria));
  const matches = criteria.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith(SPONDEE_PROMISE_COMMITMENT_PREFIX),
  );
  assert.equal(matches.length, 1);
  const decoded = decodeHealthFactorPromiseCommitmentCriterion(matches[0]);
  assert.ok(decoded);
  return decoded;
}

test("Promise Card is deterministic and refuses invented confidence", () => {
  const first = buildHealthFactorPromise(task, 10n);
  const second = buildHealthFactorPromise(task, 10n);

  assert.equal(first.promise_id, second.promise_id);
  assert.equal(first.confidence, null);
  assert.equal(first.confidence_status, "UNSCORED_UNTIL_OBSERVED_CALIBRATION");
  assert.equal(first.evidence_class, "SIMULATION");
  assert.equal(first.expected_downside.breach_projected, true);
  assert.equal(first.timing.expected_warning_lead_seconds, 120);
  assert.equal(hashHealthFactorPromise(first), hashHealthFactorPromise(second));
});

test("chain task carrier survives the SDK claim sanitizer alphabet", () => {
  const encoded = encodeHealthFactorTaskForChain(task);
  assert.match(encoded, /^SPONDEE_TASK_B64_V1:[A-Za-z0-9_-]+$/);
  assert.equal(encoded.includes("["), false);
  assert.equal(encoded.includes("]"), false);
  assert.deepEqual(parseHealthFactorTask(encoded), task);
});

test("Negotiation enrichment binds only a compact Promise commitment into SDK-preserved success_criteria", () => {
  const original = {
    task_description: encodeHealthFactorTaskForChain(task),
    terms: {
      deliverables: "Spondee Health Factor Outcome Receipt",
      quality_standards: "Preserve promise id and scenario evidence class",
      success_criteria: ["keep this existing criterion"],
    },
  };

  const enriched = enrichHealthFactorNegotiation(original, 25n);
  assert.ok(enriched.promise);
  assert.ok(enriched.commitment);
  const terms = enriched.request.terms as Record<string, unknown>;
  const criteria = terms.success_criteria as unknown[];
  assert.ok(criteria.includes("keep this existing criterion"));
  const commitment = decodeCommitment(criteria);
  assert.deepEqual(commitment, buildHealthFactorPromiseCommitment(enriched.promise));
  assert.equal(commitment.promise_id, enriched.promise.promise_id);
  assert.equal(commitment.scenario_id, enriched.promise.scenario_id);
  assert.equal(commitment.promise_sha256, hashHealthFactorPromise(enriched.promise));
  assert.ok(
    encodeHealthFactorPromiseCommitmentCriterion(enriched.promise).length <
      JSON.stringify(enriched.promise).length / 3,
  );
  assert.equal("spondee_promise" in terms, false);
});

test("Outcome Receipt reconstructs and verifies the committed Promise from the chain-safe task", () => {
  const promise = buildHealthFactorPromise(task, 25n);
  const prompt =
    "You accepted and were paid for the following job. Produce the deliverable now.\n\n" +
    "JOB CONTEXT:\n" +
    JSON.stringify({
      task: encodeHealthFactorTaskForChain(task),
      terms: {
        success_criteria: [encodeHealthFactorPromiseCommitmentCriterion(promise)],
      },
    });

  const receipt = buildHealthFactorOutcomeFromWorkPrompt(prompt);
  assert.ok(receipt);
  assert.equal(receipt.promise_id, promise.promise_id);
  assert.equal(receipt.scenario_id, task.scenario_id);
  assert.equal(receipt.evidence_class, "SIMULATION");
  assert.equal(receipt.calibration.eligible_for_observed_agent_advantage, false);
  assert.equal(receipt.outcome.floor_crossed, true);
  assert.equal(receipt.outcome.useful_lead_seconds, 120);
});

test("Outcome Receipt fails closed when a Promise commitment hash is tampered", () => {
  const promise = buildHealthFactorPromise(task, 25n);
  const commitment = buildHealthFactorPromiseCommitment(promise);
  const tampered = `${SPONDEE_PROMISE_COMMITMENT_PREFIX}${JSON.stringify({
    p: commitment.promise_id,
    s: commitment.scenario_id,
    r: commitment.price_raw,
    h: "0".repeat(64),
  })}`;
  const prompt =
    "JOB CONTEXT:\n" +
    JSON.stringify({
      task: encodeHealthFactorTaskForChain(task),
      terms: { success_criteria: [tampered] },
    });

  assert.equal(buildHealthFactorOutcomeFromWorkPrompt(prompt), null);
});

test("Non-Spondee work is not intercepted", () => {
  const receipt = buildHealthFactorOutcomeFromWorkPrompt(
    "JOB CONTEXT:\n" + JSON.stringify({ task: "write a poem", terms: {} }),
  );
  assert.equal(receipt, null);
});
