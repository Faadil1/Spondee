import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHealthFactorOutcomeFromWorkPrompt,
  buildHealthFactorPromise,
  enrichHealthFactorNegotiation,
  HealthFactorTaskSchema,
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

test("Promise Card is deterministic and refuses invented confidence", () => {
  const first = buildHealthFactorPromise(task, 10n);
  const second = buildHealthFactorPromise(task, 10n);

  assert.equal(first.promise_id, second.promise_id);
  assert.equal(first.confidence, null);
  assert.equal(first.confidence_status, "UNSCORED_UNTIL_OBSERVED_CALIBRATION");
  assert.equal(first.evidence_class, "SIMULATION");
  assert.equal(first.expected_downside.breach_projected, true);
  assert.equal(first.timing.expected_warning_lead_seconds, 120);
});

test("Negotiation enrichment binds the Promise Card into signed terms", () => {
  const original = {
    task_description: JSON.stringify(task),
    terms: {
      deliverables: "Spondee Health Factor Outcome Receipt",
      quality_standards: "Preserve promise id and scenario evidence class",
    },
  };

  const enriched = enrichHealthFactorNegotiation(original, 25n);
  assert.ok(enriched.promise);
  assert.equal(
    (enriched.request.terms as Record<string, unknown>).spondee_promise,
    enriched.promise,
  );
  assert.equal(original.terms && "spondee_promise" in original.terms, false);
});

test("Outcome Receipt binds to the Promise and remains simulation-only", () => {
  const promise = buildHealthFactorPromise(task, 25n);
  const prompt =
    "You accepted and were paid for the following job. Produce the deliverable now.\n\n" +
    "JOB CONTEXT:\n" +
    JSON.stringify({
      task: JSON.stringify(task),
      terms: { spondee_promise: promise },
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

test("Non-Spondee work is not intercepted", () => {
  const receipt = buildHealthFactorOutcomeFromWorkPrompt(
    "JOB CONTEXT:\n" + JSON.stringify({ task: "write a poem", terms: {} }),
  );
  assert.equal(receipt, null);
});
