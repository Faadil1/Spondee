import assert from "node:assert/strict";
import test from "node:test";
import { SellerAgentExecutor } from "./executor.js";
import {
  buildHealthFactorOutcomeFromWorkPrompt,
  buildHealthFactorPromiseCommitment,
  decodeHealthFactorPromiseCommitmentCriterion,
  encodeHealthFactorPromiseCommitmentCriterion,
  encodeHealthFactorTaskForChain,
  hashHealthFactorPromise,
  SPONDEE_PROMISE_COMMITMENT_PREFIX,
} from "./healthFactor.js";
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
} as const;

function baseSigning(overrides: Partial<SigningApi> = {}): SigningApi {
  return {
    listPrice: () => 0n,
    clampPrice: (value) => value,
    signQuote: async () => ({ accepted: true }),
    verifySignedJob: async () => ({ ok: true, reason: "test", permanent: false }),
    jobSpec: async () => null,
    submitResult: async () => ({ submitTx: "0xtest", deliverableUrl: null }),
    ...overrides,
  };
}

function executor(opts: {
  signing?: SigningApi;
  runWork?: (prompt: string, opts: { sessionId: string; abortSignal?: AbortSignal }) => Promise<string>;
} = {}): SellerAgentExecutor {
  return new SellerAgentExecutor({
    runWork: opts.runWork ?? (async () => "unused"),
    generator: "spondee-test",
    network: "bsc-testnet",
    commerceSkills: true,
    signing: opts.signing ?? baseSigning(),
    pendingJobs: async () => ({ jobs: [] }),
  });
}

function decodeCommitment(criteria: unknown) {
  assert.ok(Array.isArray(criteria));
  const carriers = criteria.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith(SPONDEE_PROMISE_COMMITMENT_PREFIX),
  );
  assert.equal(carriers.length, 1);
  const commitment = decodeHealthFactorPromiseCommitmentCriterion(carriers[0]);
  assert.ok(commitment);
  return commitment;
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

test("the previewed Promise Card is committed compactly in ERC-8183 signable success_criteria", async () => {
  let signedRequest: Record<string, unknown> | undefined;
  const signing = baseSigning({
    signQuote: async (request, price) => {
      signedRequest = request;
      return { accepted: true, test_price_wei: String(price) };
    },
  });
  const agent = executor({ signing });

  const preview = await agent.dispatch({
    skill: "preview_health_factor",
    task,
  });
  const previewPromise = preview.promise as any;

  const negotiated = await agent.dispatch({
    skill: "negotiate",
    task_description: encodeHealthFactorTaskForChain(task as any),
    terms: {
      deliverables: "Spondee Health Factor Outcome Receipt",
      quality_standards: "Preserve the Spondee promise and simulation evidence class",
      success_criteria: ["existing non-Spondee criterion"],
    },
  });

  assert.equal(negotiated.accepted, true);
  assert.ok(signedRequest);
  const signedTerms = signedRequest.terms as Record<string, unknown>;
  const criteria = signedTerms.success_criteria as unknown[];
  assert.ok(criteria.includes("existing non-Spondee criterion"));
  const commitment = decodeCommitment(criteria);
  assert.equal(commitment.promise_id, previewPromise.promise_id);
  assert.equal(commitment.scenario_id, previewPromise.scenario_id);
  assert.equal(commitment.promise_sha256, hashHealthFactorPromise(previewPromise));
  assert.deepEqual(commitment, buildHealthFactorPromiseCommitment(previewPromise));
  assert.equal("spondee_promise" in signedTerms, false);
});

test("notify_funded reconstructs and verifies the deterministic Promise from the compact commitment", async () => {
  let submittedContent = "";
  const previewAgent = executor();
  const preview = await previewAgent.dispatch({
    skill: "preview_health_factor",
    task,
  });
  const promise = preview.promise as any;

  const signing = baseSigning({
    jobSpec: async (jobId) => ({
      task: encodeHealthFactorTaskForChain(task as any),
      terms: {
        success_criteria: [encodeHealthFactorPromiseCommitmentCriterion(promise)],
        test_job_id: jobId,
      },
    }),
    submitResult: async (_jobId, responseContent) => {
      submittedContent = responseContent;
      return { submitTx: "0xdeterministic-test", deliverableUrl: "file://test-receipt" };
    },
  });

  const agent = executor({
    signing,
    runWork: async (prompt) => {
      const receipt = buildHealthFactorOutcomeFromWorkPrompt(prompt);
      assert.ok(receipt, "structured Health Factor jobs must bypass generic LLM work");
      return JSON.stringify(receipt);
    },
  });

  const accepted = await agent.dispatch({
    skill: "notify_funded",
    job_id: 7,
  });
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.job_id, 7);

  await agent.drain();
  assert.notEqual(submittedContent, "");
  const receipt = JSON.parse(submittedContent) as Record<string, unknown>;
  assert.equal(receipt.schema, "spondee.outcome-receipt.v1");
  assert.equal(receipt.promise_id, promise.promise_id);
  assert.equal(receipt.evidence_class, "SIMULATION");
  const calibration = receipt.calibration as Record<string, unknown>;
  assert.equal(calibration.eligible_for_observed_agent_advantage, false);
});

test("executor advertises preview alongside the generated ERC-8183 skills", () => {
  assert.deepEqual(executor().skills(), [
    "preview_health_factor",
    "negotiate",
    "notify_funded",
  ]);
});
