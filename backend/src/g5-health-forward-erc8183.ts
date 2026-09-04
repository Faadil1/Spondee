import {
  G5_HEALTH_COMMITMENT_PREFIX,
  G5HealthForwardAgentOutputSchema,
  buildG5HealthCommitment,
  buildG5HealthPromise,
  encodeG5HealthTask,
  evaluateHealthBaseline,
  type G5HealthForwardTask,
} from "./g5-health-forward.js";
import { runForwardMarketplaceActivation } from "./g5-forward-marketplace.js";
import type { LiveActivationProgress } from "./erc8183.js";

export function runG5HealthForwardActivation(
  task: G5HealthForwardTask,
  env = process.env,
  onProgress: (event: LiveActivationProgress) => void | Promise<void> = () => undefined,
) {
  return runForwardMarketplaceActivation(task, {
    executionFlag: "SPONDEE_G5_HEALTH_FORWARD_EXECUTION_ENABLED",
    sellerUrlEnv: "SPONDEE_G5_HEALTH_FORWARD_SELLER_URL",
    previewSkill: "g5_health_forward_preview",
    categoryLabel: "Health Factor Monitoring",
    taskDescription: encodeG5HealthTask,
    expectedPromise: (value) => buildG5HealthPromise(value, "0"),
    expectedCommitment: buildG5HealthCommitment,
    commitmentPrefix: G5_HEALTH_COMMITMENT_PREFIX,
    maxWaitSeconds: (value) => value.observation_rule.max_wait_seconds,
    parseOutput: (value) => G5HealthForwardAgentOutputSchema.parse(value),
    outputRounds: (output) => output.rounds,
    evaluateBaseline: evaluateHealthBaseline,
    outputScenarioId: (output) => output.scenario_id,
    taskScenarioId: (value) => value.scenario_id,
    promiseId: (promise) => promise.promise_id,
  }, env, onProgress);
}
