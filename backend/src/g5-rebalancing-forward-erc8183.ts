import {
  G5_REBALANCING_COMMITMENT_PREFIX,
  G5RebalancingForwardAgentOutputSchema,
  buildG5RebalancingCommitment,
  buildG5RebalancingPromise,
  encodeG5RebalancingTask,
  evaluateRebalancingBaseline,
  type G5RebalancingForwardTask,
} from "./g5-rebalancing-forward.js";
import { runForwardMarketplaceActivation } from "./g5-forward-marketplace.js";
import type { LiveActivationProgress } from "./erc8183.js";

export function runG5RebalancingForwardActivation(
  task: G5RebalancingForwardTask,
  env = process.env,
  onProgress: (event: LiveActivationProgress) => void | Promise<void> = () => undefined,
) {
  return runForwardMarketplaceActivation(task, {
    executionFlag: "SPONDEE_G5_REBALANCING_FORWARD_EXECUTION_ENABLED",
    sellerUrlEnv: "SPONDEE_G5_REBALANCING_FORWARD_SELLER_URL",
    previewSkill: "g5_rebalancing_forward_preview",
    categoryLabel: "Rebalancing",
    taskDescription: encodeG5RebalancingTask,
    expectedPromise: (value) => buildG5RebalancingPromise(value, "0"),
    expectedCommitment: buildG5RebalancingCommitment,
    commitmentPrefix: G5_REBALANCING_COMMITMENT_PREFIX,
    maxWaitSeconds: (value) => value.observation_rule.max_wait_seconds,
    parseOutput: (value) => G5RebalancingForwardAgentOutputSchema.parse(value),
    outputRounds: (output) => output.rounds,
    evaluateBaseline: evaluateRebalancingBaseline,
    outputScenarioId: (output) => output.scenario_id,
    taskScenarioId: (value) => value.scenario_id,
    promiseId: (promise) => promise.promise_id,
  }, env, onProgress);
}
