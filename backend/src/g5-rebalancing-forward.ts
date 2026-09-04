import { createHash } from "node:crypto";
import { z } from "zod";
import { G5_BNB_USD_FEED, type ForwardRound } from "./g5-forward-marketplace.js";

export const G5_REBALANCING_TASK_PREFIX = "SG5R1:";
export const G5_REBALANCING_COMMITMENT_PREFIX = "SPONDEE_G5_REBALANCING_FORWARD_COMMITMENT_V1:";
export const G5_REBALANCING_CLAIM_GUARDRAIL = "Observed BNB/USD paper rebalancing of a frozen hypothetical 50/50 portfolio. No mainnet trade or realized PnL is claimed and negative outcomes remain valid evidence." as const;

export const G5RebalancingForwardTaskSchema = z.object({
  schema: z.literal("spondee.rebalancing-forward-observed.task.v1"),
  scenario_id: z.string().min(1).max(160),
  evidence_class: z.literal("OBSERVED"),
  source: z.object({
    chain_id: z.literal(56), network: z.literal("bsc-mainnet"), feed_address: z.literal(G5_BNB_USD_FEED), feed_description: z.literal("BNB / USD"),
  }),
  freeze: z.object({ round_id: z.string().regex(/^\d+$/), price_usd: z.number().positive(), updated_at: z.string().datetime(), frozen_at: z.string().datetime() }),
  observation_rule: z.object({ only_rounds_after_activation: z.literal(true), target_future_rounds: z.number().int().min(5).max(20), max_wait_seconds: z.number().int().min(120).max(900), poll_seconds: z.number().int().min(2).max(30) }),
  portfolio: z.object({
    capital_usd: z.number().positive(),
    target_bnb_weight_pct: z.number().min(1).max(99),
    starting_bnb_weight_pct: z.number().min(1).max(99),
    rebalance_tolerance_bps: z.number().int().min(1).max(500),
    fee_bps: z.number().nonnegative().max(1000),
    slippage_bps: z.number().nonnegative().max(1000),
    baseline: z.literal("NO_REBALANCE_STATIC_HOLD"),
  }),
  claim_guardrail: z.literal(G5_REBALANCING_CLAIM_GUARDRAIL),
});
export type G5RebalancingForwardTask = z.infer<typeof G5RebalancingForwardTaskSchema>;

export const G5RebalancingForwardAgentOutputSchema = z.object({
  schema: z.literal("spondee.rebalancing-forward-observed-agent-output.v1"),
  scenario_id: z.string().min(1),
  observation_started_at: z.string().datetime(),
  observation_completed_at: z.string().datetime(),
  rounds: z.array(z.object({ round_id: z.string().regex(/^\d+$/), price_usd: z.number().positive(), updated_at: z.string().datetime() })).min(5),
  strategy_result: z.object({
    initial_equity_usd: z.number(),
    terminal_equity_usd: z.number(),
    target_bnb_weight_pct: z.number(),
    terminal_bnb_weight_pct: z.number(),
    terminal_deviation_bps: z.number().nonnegative(),
    max_deviation_bps: z.number().nonnegative(),
    rebalance_count: z.number().int().nonnegative(),
    estimated_execution_friction_usd: z.number().nonnegative(),
    final_cash_usd: z.number(),
    final_bnb: z.number(),
  }),
  wallet_used_for_market_data: z.literal(false),
  mainnet_chain_write_attempted: z.literal(false),
  realized_mainnet_pnl_claimed: z.literal(false),
});
export type G5RebalancingForwardAgentOutput = z.infer<typeof G5RebalancingForwardAgentOutputSchema>;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
export function g5RebalancingHash(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex"); }
function round(value: number, digits = 8) { const p = 10 ** digits; return Math.round(value * p) / p; }

export function encodeG5RebalancingTask(task: G5RebalancingForwardTask): string {
  const parsed = G5RebalancingForwardTaskSchema.parse(task);
  const tuple = [parsed.scenario_id, parsed.freeze.round_id, parsed.freeze.price_usd, parsed.freeze.updated_at, parsed.freeze.frozen_at, parsed.observation_rule.target_future_rounds, parsed.observation_rule.max_wait_seconds, parsed.observation_rule.poll_seconds, parsed.portfolio.capital_usd, parsed.portfolio.target_bnb_weight_pct, parsed.portfolio.starting_bnb_weight_pct, parsed.portfolio.rebalance_tolerance_bps, parsed.portfolio.fee_bps, parsed.portfolio.slippage_bps];
  return `${G5_REBALANCING_TASK_PREFIX}${Buffer.from(JSON.stringify(tuple), "utf8").toString("base64url")}`;
}

export function decodeG5RebalancingTask(value: unknown): G5RebalancingForwardTask | null {
  if (typeof value !== "string" || !value.startsWith(G5_REBALANCING_TASK_PREFIX)) return null;
  try {
    const tuple = JSON.parse(Buffer.from(value.slice(G5_REBALANCING_TASK_PREFIX.length), "base64url").toString("utf8"));
    if (!Array.isArray(tuple) || tuple.length !== 14) return null;
    const [scenarioId, roundId, priceUsd, updatedAt, frozenAt, targetRounds, maxWait, pollSeconds, capital, targetWeight, startingWeight, tolerance, feeBps, slippageBps] = tuple;
    return G5RebalancingForwardTaskSchema.parse({
      schema: "spondee.rebalancing-forward-observed.task.v1", scenario_id: scenarioId, evidence_class: "OBSERVED",
      source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_BNB_USD_FEED, feed_description: "BNB / USD" },
      freeze: { round_id: roundId, price_usd: priceUsd, updated_at: updatedAt, frozen_at: frozenAt },
      observation_rule: { only_rounds_after_activation: true, target_future_rounds: targetRounds, max_wait_seconds: maxWait, poll_seconds: pollSeconds },
      portfolio: { capital_usd: capital, target_bnb_weight_pct: targetWeight, starting_bnb_weight_pct: startingWeight, rebalance_tolerance_bps: tolerance, fee_bps: feeBps, slippage_bps: slippageBps, baseline: "NO_REBALANCE_STATIC_HOLD" },
      claim_guardrail: G5_REBALANCING_CLAIM_GUARDRAIL,
    });
  } catch { return null; }
}

export type G5RebalancingPromise = {
  schema: "spondee.rebalancing-forward-observed-promise.v1";
  promise_id: string;
  scenario_id: string;
  category: "Rebalancing";
  evidence_class: "OBSERVED_PENDING_FORWARD_WINDOW";
  freeze_round_id: string;
  target_bnb_weight_pct: number;
  tolerance_bps: number;
  target_future_rounds: number;
  price_raw: string;
  created_at: string;
  claim_guardrail: string;
};
export function buildG5RebalancingPromise(task: G5RebalancingForwardTask, priceRaw = "0"): G5RebalancingPromise {
  const seed = { scenario_id: task.scenario_id, freeze: task.freeze, observation_rule: task.observation_rule, portfolio: task.portfolio, price_raw: priceRaw };
  return { schema: "spondee.rebalancing-forward-observed-promise.v1", promise_id: `spr5_${g5RebalancingHash(seed).slice(0,24)}`, scenario_id: task.scenario_id, category: "Rebalancing", evidence_class: "OBSERVED_PENDING_FORWARD_WINDOW", freeze_round_id: task.freeze.round_id, target_bnb_weight_pct: task.portfolio.target_bnb_weight_pct, tolerance_bps: task.portfolio.rebalance_tolerance_bps, target_future_rounds: task.observation_rule.target_future_rounds, price_raw: priceRaw, created_at: task.freeze.frozen_at, claim_guardrail: G5_REBALANCING_CLAIM_GUARDRAIL };
}
export function buildG5RebalancingCommitment(promise: G5RebalancingPromise): Record<string, unknown> {
  return { schema: "spondee.rebalancing-forward-observed-commitment.v1", promise_id: promise.promise_id, scenario_id: promise.scenario_id, promise_sha256: g5RebalancingHash(promise), price_raw: promise.price_raw };
}
export function encodeG5RebalancingCommitment(promise: G5RebalancingPromise): string {
  return `${G5_REBALANCING_COMMITMENT_PREFIX}${Buffer.from(JSON.stringify(buildG5RebalancingCommitment(promise)), "utf8").toString("base64url")}`;
}

function weightPct(cash: number, bnb: number, price: number): number {
  const equity = cash + bnb * price;
  return equity <= 0 ? 0 : (bnb * price / equity) * 100;
}

export function evaluateRebalancingAgent(task: G5RebalancingForwardTask, rounds: ForwardRound[]) {
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error("insufficient forward rounds");
  const initial = task.portfolio.capital_usd;
  const initialBnbValue = initial * task.portfolio.starting_bnb_weight_pct / 100;
  let cash = initial - initialBnbValue;
  let bnb = initialBnbValue / task.freeze.price_usd;
  const frictionRate = (task.portfolio.fee_bps + task.portfolio.slippage_bps) / 10_000;
  let friction = 0;
  let rebalances = 0;
  let maxDeviation = Math.abs(task.portfolio.starting_bnb_weight_pct - task.portfolio.target_bnb_weight_pct) * 100;
  for (const observed of rounds) {
    const beforeWeight = weightPct(cash, bnb, observed.price_usd);
    const deviation = Math.abs(beforeWeight - task.portfolio.target_bnb_weight_pct) * 100;
    maxDeviation = Math.max(maxDeviation, deviation);
    if (deviation <= task.portfolio.rebalance_tolerance_bps) continue;
    const equity = cash + bnb * observed.price_usd;
    const targetBnbValue = equity * task.portfolio.target_bnb_weight_pct / 100;
    const currentBnbValue = bnb * observed.price_usd;
    const deltaValue = targetBnbValue - currentBnbValue;
    const grossTrade = Math.abs(deltaValue);
    const cost = grossTrade * frictionRate;
    if (deltaValue > 0) {
      const spend = Math.min(grossTrade, Math.max(0, cash - cost));
      cash -= spend + cost;
      bnb += spend / observed.price_usd;
    } else {
      const sellValue = Math.min(grossTrade, bnb * observed.price_usd);
      bnb -= sellValue / observed.price_usd;
      cash += sellValue - cost;
    }
    friction += cost;
    rebalances += 1;
  }
  const terminalPrice = rounds.at(-1)!.price_usd;
  const terminalEquity = cash + bnb * terminalPrice;
  const terminalWeight = weightPct(cash, bnb, terminalPrice);
  return {
    initial_equity_usd: round(initial, 6), terminal_equity_usd: round(terminalEquity, 6), target_bnb_weight_pct: task.portfolio.target_bnb_weight_pct,
    terminal_bnb_weight_pct: round(terminalWeight, 6), terminal_deviation_bps: round(Math.abs(terminalWeight - task.portfolio.target_bnb_weight_pct) * 100, 6), max_deviation_bps: round(maxDeviation, 6), rebalance_count: rebalances,
    estimated_execution_friction_usd: round(friction, 6), final_cash_usd: round(cash, 6), final_bnb: round(bnb, 10),
  };
}

export function evaluateRebalancingBaseline(task: G5RebalancingForwardTask, rounds: ForwardRound[]) {
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error("insufficient forward rounds");
  const initial = task.portfolio.capital_usd;
  const initialBnbValue = initial * task.portfolio.starting_bnb_weight_pct / 100;
  const cash = initial - initialBnbValue;
  const bnb = initialBnbValue / task.freeze.price_usd;
  let maxDeviation = Math.abs(task.portfolio.starting_bnb_weight_pct - task.portfolio.target_bnb_weight_pct) * 100;
  for (const observed of rounds) maxDeviation = Math.max(maxDeviation, Math.abs(weightPct(cash, bnb, observed.price_usd) - task.portfolio.target_bnb_weight_pct) * 100);
  const terminalPrice = rounds.at(-1)!.price_usd;
  const terminalEquity = cash + bnb * terminalPrice;
  const terminalWeight = weightPct(cash, bnb, terminalPrice);
  return { policy: "NO_REBALANCE_STATIC_HOLD", initial_equity_usd: round(initial,6), terminal_equity_usd: round(terminalEquity,6), target_bnb_weight_pct: task.portfolio.target_bnb_weight_pct, terminal_bnb_weight_pct: round(terminalWeight,6), terminal_deviation_bps: round(Math.abs(terminalWeight-task.portfolio.target_bnb_weight_pct)*100,6), max_deviation_bps: round(maxDeviation,6), estimated_execution_friction_usd: 0 };
}
