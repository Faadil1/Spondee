import assert from "node:assert/strict";
import test from "node:test";
import {
  SPONDEE_PROMISE_COMMITMENT_PREFIX,
  buildCategoryPromise,
  buildHealthFactorOutcomeFromWorkPrompt,
  currentAgentKind,
  currentAgentMetadata,
  demoTaskForCurrentAgent,
  encodeCategoryPromiseCommitmentCriterion,
  encodeCategoryTaskForChain,
  enrichHealthFactorNegotiation,
  parseCategoryTask,
  previewHealthFactorFromEnvelope,
} from "./healthFactor.js";

function wrongTask(): Record<string, unknown> {
  const kind = currentAgentKind();
  if (kind !== "grid") {
    return {
      schema: "spondee.grid.task.v1",
      scenario_id: "wrong-grid",
      evidence_class: "SIMULATION",
      capital_usd: 1000,
      lower_price: 90,
      upper_price: 110,
      levels: 3,
      fee_bps: 10,
      slippage_bps: 5,
      declared_price_path: [{ at_seconds: 0, price: 100 }, { at_seconds: 60, price: 105 }],
    };
  }
  return {
    schema: "spondee.yield.task.v1",
    scenario_id: "wrong-yield",
    evidence_class: "SIMULATION",
    capital_usd: 1000,
    horizon_days: 30,
    max_risk_score: 50,
    current: { id: "current", gross_apr_pct: 5, risk_score: 20, switch_cost_usd: 0 },
    candidates: [{ id: "candidate", gross_apr_pct: 6, risk_score: 30, switch_cost_usd: 1 }],
  };
}

test("category agent accepts only its own schema", () => {
  const task = demoTaskForCurrentAgent();
  assert.ok(parseCategoryTask(task));
  assert.equal(parseCategoryTask(wrongTask()), null);
  const encoded = encodeCategoryTaskForChain(task);
  const roundtrip = parseCategoryTask(encoded);
  assert.deepEqual(roundtrip, task);
});

test("preview and negotiation preserve zero-price compact Promise commitment", () => {
  const task = demoTaskForCurrentAgent();
  const meta = currentAgentMetadata();
  const preview = previewHealthFactorFromEnvelope({ task }, 0n);
  assert.ok(preview);
  assert.equal(preview.category, meta.category);
  assert.equal(preview.evidence_class, "SIMULATION");
  assert.equal(preview.expected_cost.amount, "0");
  assert.equal(preview.confidence, null);

  const enriched = enrichHealthFactorNegotiation({
    task_description: encodeCategoryTaskForChain(task),
    terms: { success_criteria: ["preserve-me"] },
  }, 0n);
  assert.ok(enriched.promise);
  assert.ok(enriched.commitment);
  const criteria = (enriched.request.terms as { success_criteria: string[] }).success_criteria;
  assert.equal(criteria.filter((x) => x.startsWith(SPONDEE_PROMISE_COMMITMENT_PREFIX)).length, 1);
  assert.ok(criteria.includes("preserve-me"));
});

test("deterministic work reconstructs Promise and emits SIMULATION receipt", () => {
  const task = demoTaskForCurrentAgent();
  const promise = buildCategoryPromise(task, 0n);
  const prompt = "You accepted and were paid for the following job. Produce the deliverable now.\n\nJOB CONTEXT:\n" + JSON.stringify({
    task: encodeCategoryTaskForChain(task),
    terms: { success_criteria: [encodeCategoryPromiseCommitmentCriterion(promise)] },
  });
  const receipt = buildHealthFactorOutcomeFromWorkPrompt(prompt);
  assert.ok(receipt);
  assert.equal(receipt.promise_id, promise.promise_id);
  assert.equal(receipt.scenario_id, task.scenario_id);
  assert.equal(receipt.category, currentAgentMetadata().category);
  assert.equal(receipt.evidence_class, "SIMULATION");
  assert.equal(receipt.calibration.eligible_for_observed_agent_advantage, false);
});

test("tampered Promise commitment fails closed", () => {
  const task = demoTaskForCurrentAgent();
  const promise = buildCategoryPromise(task, 0n);
  const criterion = encodeCategoryPromiseCommitmentCriterion(promise);
  const prefix = SPONDEE_PROMISE_COMMITMENT_PREFIX;
  const body = JSON.parse(criterion.slice(prefix.length)) as { h: string };
  body.h = `${body.h[0] === "0" ? "1" : "0"}${body.h.slice(1)}`;
  const prompt = "JOB CONTEXT:\n" + JSON.stringify({
    task: encodeCategoryTaskForChain(task),
    terms: { success_criteria: [`${prefix}${JSON.stringify(body)}`] },
  });
  assert.equal(buildHealthFactorOutcomeFromWorkPrompt(prompt), null);
});
