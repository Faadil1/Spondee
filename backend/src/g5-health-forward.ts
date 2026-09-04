import { createHash } from "node:crypto";
import { z } from "zod";
import { G5_BNB_USD_FEED, type ForwardRound } from "./g5-forward-marketplace.js";

export const G5_HEALTH_TASK_PREFIX = "SG5H1:";
export const G5_HEALTH_COMMITMENT_PREFIX = "SPONDEE_G5_HEALTH_FORWARD_COMMITMENT_V1:";
export const G5_HEALTH_CLAIM_GUARDRAIL = "Observed BNB/USD monitoring of a frozen hypothetical collateral/debt position. No mainnet value moves and no liquidation-prevention or safety guarantee is claimed." as const;

export const G5HealthForwardTaskSchema = z.object({
  schema: z.literal("spondee.health-forward-observed.task.v1"),
  scenario_id: z.string().min(1).max(160),
  evidence_class: z.literal("OBSERVED"),
  source: z.object({
    chain_id: z.literal(56),
    network: z.literal("bsc-mainnet"),
    feed_address: z.literal(G5_BNB_USD_FEED),
    feed_description: z.literal("BNB / USD"),
  }),
  freeze: z.object({
    round_id: z.string().regex(/^\d+$/),
    price_usd: z.number().positive(),
    updated_at: z.string().datetime(),
    frozen_at: z.string().datetime(),
  }),
  observation_rule: z.object({
    only_rounds_after_activation: z.literal(true),
    target_future_rounds: z.number().int().min(5).max(20),
    max_wait_seconds: z.number().int().min(120).max(900),
    poll_seconds: z.number().int().min(2).max(30),
  }),
  position: z.object({
    collateral_bnb: z.number().positive(),
    debt_usd: z.number().positive(),
    liquidation_threshold: z.number().positive().max(1),
    warning_health_factor: z.number().min(1).max(3),
    critical_health_factor: z.number().positive().max(2),
    baseline_check_every_rounds: z.number().int().min(2).max(10),
  }),
  claim_guardrail: z.literal(G5_HEALTH_CLAIM_GUARDRAIL),
}).superRefine((task, ctx) => {
  const initial = healthFactor(task.position.collateral_bnb, task.freeze.price_usd, task.position.liquidation_threshold, task.position.debt_usd);
  if (initial > task.position.warning_health_factor) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["position", "warning_health_factor"], message: "frozen position must already be inside the declared warning band so the warning contract is deterministic before the future window" });
  }
  if (task.position.critical_health_factor >= task.position.warning_health_factor) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["position", "critical_health_factor"], message: "critical threshold must be below warning threshold" });
  }
});
export type G5HealthForwardTask = z.infer<typeof G5HealthForwardTaskSchema>;

export const G5HealthForwardAgentOutputSchema = z.object({
  schema: z.literal("spondee.health-forward-observed-agent-output.v1"),
  scenario_id: z.string().min(1),
  observation_started_at: z.string().datetime(),
  observation_completed_at: z.string().datetime(),
  rounds: z.array(z.object({ round_id: z.string().regex(/^\d+$/), price_usd: z.number().positive(), updated_at: z.string().datetime() })).min(5),
  health_path: z.array(z.object({ round_id: z.string(), updated_at: z.string().datetime(), price_usd: z.number().positive(), health_factor: z.number().positive() })).min(5),
  event_tape: z.object({
    warning_emitted_at: z.string().datetime(),
    intervention_recommended_at: z.string().datetime(),
    baseline_first_check_at: z.string().datetime(),
    baseline_warning_detected_at: z.string().datetime(),
    adverse_event_at: z.string().datetime().nullable(),
    warning_lead_time_seconds: z.number().nonnegative(),
    response_latency_ms: z.number().nonnegative(),
  }),
  result: z.object({
    initial_health_factor: z.number().positive(),
    minimum_observed_health_factor: z.number().positive(),
    warning_threshold: z.number().positive(),
    critical_threshold: z.number().positive(),
    warning_was_actionable_before_baseline_check: z.boolean(),
    adverse_event_observed: z.boolean(),
  }),
  wallet_used_for_market_data: z.literal(false),
  mainnet_chain_write_attempted: z.literal(false),
  liquidation_prevention_claimed: z.literal(false),
});
export type G5HealthForwardAgentOutput = z.infer<typeof G5HealthForwardAgentOutputSchema>;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function g5HealthHash(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex"); }

export function healthFactor(collateralBnb: number, priceUsd: number, liquidationThreshold: number, debtUsd: number): number {
  return (collateralBnb * priceUsd * liquidationThreshold) / debtUsd;
}

export function encodeG5HealthTask(task: G5HealthForwardTask): string {
  const parsed = G5HealthForwardTaskSchema.parse(task);
  const tuple = [
    parsed.scenario_id,
    parsed.freeze.round_id,
    parsed.freeze.price_usd,
    parsed.freeze.updated_at,
    parsed.freeze.frozen_at,
    parsed.observation_rule.target_future_rounds,
    parsed.observation_rule.max_wait_seconds,
    parsed.observation_rule.poll_seconds,
    parsed.position.collateral_bnb,
    parsed.position.debt_usd,
    parsed.position.liquidation_threshold,
    parsed.position.warning_health_factor,
    parsed.position.critical_health_factor,
    parsed.position.baseline_check_every_rounds,
  ];
  return `${G5_HEALTH_TASK_PREFIX}${Buffer.from(JSON.stringify(tuple), "utf8").toString("base64url")}`;
}

export function decodeG5HealthTask(value: unknown): G5HealthForwardTask | null {
  if (typeof value !== "string" || !value.startsWith(G5_HEALTH_TASK_PREFIX)) return null;
  try {
    const tuple = JSON.parse(Buffer.from(value.slice(G5_HEALTH_TASK_PREFIX.length), "base64url").toString("utf8"));
    if (!Array.isArray(tuple) || tuple.length !== 14) return null;
    const [scenarioId, roundId, priceUsd, updatedAt, frozenAt, targetRounds, maxWait, pollSeconds, collateralBnb, debtUsd, liquidationThreshold, warningHf, criticalHf, baselineEvery] = tuple;
    return G5HealthForwardTaskSchema.parse({
      schema: "spondee.health-forward-observed.task.v1",
      scenario_id: scenarioId,
      evidence_class: "OBSERVED",
      source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_BNB_USD_FEED, feed_description: "BNB / USD" },
      freeze: { round_id: roundId, price_usd: priceUsd, updated_at: updatedAt, frozen_at: frozenAt },
      observation_rule: { only_rounds_after_activation: true, target_future_rounds: targetRounds, max_wait_seconds: maxWait, poll_seconds: pollSeconds },
      position: { collateral_bnb: collateralBnb, debt_usd: debtUsd, liquidation_threshold: liquidationThreshold, warning_health_factor: warningHf, critical_health_factor: criticalHf, baseline_check_every_rounds: baselineEvery },
      claim_guardrail: G5_HEALTH_CLAIM_GUARDRAIL,
    });
  } catch { return null; }
}

export type G5HealthPromise = {
  schema: "spondee.health-forward-observed-promise.v1";
  promise_id: string;
  scenario_id: string;
  category: "Health Factor Monitoring";
  evidence_class: "OBSERVED_PENDING_FORWARD_WINDOW";
  freeze_round_id: string;
  initial_health_factor: number;
  warning_health_factor: number;
  critical_health_factor: number;
  baseline_check_every_rounds: number;
  target_future_rounds: number;
  price_raw: string;
  created_at: string;
  claim_guardrail: string;
};

export function buildG5HealthPromise(task: G5HealthForwardTask, priceRaw = "0"): G5HealthPromise {
  const initial = healthFactor(task.position.collateral_bnb, task.freeze.price_usd, task.position.liquidation_threshold, task.position.debt_usd);
  const seed = { scenario_id: task.scenario_id, freeze: task.freeze, observation_rule: task.observation_rule, position: task.position, price_raw: priceRaw };
  return {
    schema: "spondee.health-forward-observed-promise.v1",
    promise_id: `sph5_${g5HealthHash(seed).slice(0, 24)}`,
    scenario_id: task.scenario_id,
    category: "Health Factor Monitoring",
    evidence_class: "OBSERVED_PENDING_FORWARD_WINDOW",
    freeze_round_id: task.freeze.round_id,
    initial_health_factor: Number(initial.toFixed(8)),
    warning_health_factor: task.position.warning_health_factor,
    critical_health_factor: task.position.critical_health_factor,
    baseline_check_every_rounds: task.position.baseline_check_every_rounds,
    target_future_rounds: task.observation_rule.target_future_rounds,
    price_raw: priceRaw,
    created_at: task.freeze.frozen_at,
    claim_guardrail: G5_HEALTH_CLAIM_GUARDRAIL,
  };
}

export function buildG5HealthCommitment(promise: G5HealthPromise): Record<string, unknown> {
  return { schema: "spondee.health-forward-observed-commitment.v1", promise_id: promise.promise_id, scenario_id: promise.scenario_id, promise_sha256: g5HealthHash(promise), price_raw: promise.price_raw };
}
export function encodeG5HealthCommitment(promise: G5HealthPromise): string {
  return `${G5_HEALTH_COMMITMENT_PREFIX}${Buffer.from(JSON.stringify(buildG5HealthCommitment(promise)), "utf8").toString("base64url")}`;
}

export function evaluateHealthBaseline(task: G5HealthForwardTask, rounds: ForwardRound[]) {
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error("insufficient forward rounds");
  const index = Math.min(task.position.baseline_check_every_rounds - 1, rounds.length - 1);
  const firstCheck = rounds[index]!;
  const hf = healthFactor(task.position.collateral_bnb, firstCheck.price_usd, task.position.liquidation_threshold, task.position.debt_usd);
  const path = rounds.map((round) => ({ ...round, health_factor: healthFactor(task.position.collateral_bnb, round.price_usd, task.position.liquidation_threshold, task.position.debt_usd) }));
  return {
    policy: `MANUAL_CHECK_EVERY_${task.position.baseline_check_every_rounds}_CHAINLINK_ROUNDS`,
    first_check_round_id: firstCheck.round_id,
    first_check_at: firstCheck.updated_at,
    warning_detected: hf <= task.position.warning_health_factor,
    warning_detected_at: firstCheck.updated_at,
    health_factor_at_first_check: Number(hf.toFixed(8)),
    minimum_observed_health_factor: Number(Math.min(...path.map((row) => row.health_factor)).toFixed(8)),
  };
}

export function buildHealthEventTape(task: G5HealthForwardTask, rounds: ForwardRound[], observationStartedAt: string, interventionAt = observationStartedAt) {
  const baseline = evaluateHealthBaseline(task, rounds);
  const path = rounds.map((round) => ({
    round_id: round.round_id,
    updated_at: round.updated_at,
    price_usd: round.price_usd,
    health_factor: Number(healthFactor(task.position.collateral_bnb, round.price_usd, task.position.liquidation_threshold, task.position.debt_usd).toFixed(8)),
  }));
  const adverse = path.find((row) => row.health_factor <= task.position.critical_health_factor) ?? null;
  const warningLead = Math.max(0, (Date.parse(baseline.first_check_at) - Date.parse(observationStartedAt)) / 1000);
  const responseLatency = Math.max(0, Date.parse(interventionAt) - Date.parse(observationStartedAt));
  return {
    health_path: path,
    event_tape: {
      warning_emitted_at: observationStartedAt,
      intervention_recommended_at: interventionAt,
      baseline_first_check_at: baseline.first_check_at,
      baseline_warning_detected_at: baseline.warning_detected_at,
      adverse_event_at: adverse?.updated_at ?? null,
      warning_lead_time_seconds: warningLead,
      response_latency_ms: responseLatency,
    },
    result: {
      initial_health_factor: buildG5HealthPromise(task).initial_health_factor,
      minimum_observed_health_factor: Number(Math.min(...path.map((row) => row.health_factor)).toFixed(8)),
      warning_threshold: task.position.warning_health_factor,
      critical_threshold: task.position.critical_health_factor,
      warning_was_actionable_before_baseline_check: warningLead > 0,
      adverse_event_observed: adverse !== null,
    },
  };
}
