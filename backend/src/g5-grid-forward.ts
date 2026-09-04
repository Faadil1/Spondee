import { createHash } from "node:crypto";
import { z } from "zod";

export const G5_GRID_FEED = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" as const;
export const G5_GRID_TASK_PREFIX = "SPONDEE_G5_GRID_FORWARD_TASK_B64_V1:";
export const G5_GRID_TASK_PREFIX_V2 = "SG5F2:";
export const G5_GRID_COMMITMENT_PREFIX = "SPONDEE_G5_GRID_FORWARD_COMMITMENT_V1:";
const CLAIM_GUARDRAIL = "Forward observed-market-data task only. No mainnet trade is executed; paper returns are not realized PnL and do not guarantee future performance." as const;

export const G5GridForwardTaskSchema = z.object({
  schema: z.literal("spondee.grid-forward-observed.task.v1"),
  scenario_id: z.string().min(1).max(160),
  evidence_class: z.literal("OBSERVED"),
  source: z.object({
    chain_id: z.literal(56),
    network: z.literal("bsc-mainnet"),
    feed_address: z.literal(G5_GRID_FEED),
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
  strategy: z.object({
    capital_usd: z.number().positive(),
    starting_allocation: z.literal("50% USD / 50% BNB"),
    levels: z.number().int().min(3).max(25),
    half_width_pct: z.number().positive().max(10),
    fee_bps: z.number().nonnegative().max(1000),
    slippage_bps: z.number().nonnegative().max(1000),
    baseline: z.literal("STATIC_50_50_BUY_AND_HOLD"),
  }),
  claim_guardrail: z.literal(CLAIM_GUARDRAIL),
});

export type G5GridForwardTask = z.infer<typeof G5GridForwardTaskSchema>;

export const G5ObservedRoundSchema = z.object({
  round_id: z.string().regex(/^\d+$/),
  price_usd: z.number().positive(),
  updated_at: z.string().datetime(),
});
export type G5ObservedRound = z.infer<typeof G5ObservedRoundSchema>;

export const G5GridForwardAgentOutputSchema = z.object({
  schema: z.literal("spondee.grid-forward-observed-agent-output.v1"),
  scenario_id: z.string().min(1),
  observation_started_at: z.string().datetime(),
  observation_completed_at: z.string().datetime(),
  rounds: z.array(G5ObservedRoundSchema).min(5),
  strategy_result: z.object({
    strategy: z.literal("bounded_symmetric_paper_grid_on_forward_chainlink_path"),
    initial_equity_usd: z.number(),
    terminal_equity_usd: z.number(),
    gross_return_pct: z.number(),
    net_return_pct: z.number(),
    max_drawdown_pct: z.number().nonnegative(),
    estimated_execution_friction_usd: z.number().nonnegative(),
    fill_count: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    flat: z.number().int().nonnegative(),
    final_cash_usd: z.number(),
    final_bnb: z.number(),
    parameters: z.record(z.unknown()),
  }),
  wallet_used_for_market_data: z.literal(false),
  mainnet_chain_write_attempted: z.literal(false),
  realized_mainnet_pnl_claimed: z.literal(false),
});
export type G5GridForwardAgentOutput = z.infer<typeof G5GridForwardAgentOutputSchema>;
export type StrategyResult = G5GridForwardAgentOutput["strategy_result"];

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function compactTuple(task: G5GridForwardTask): unknown[] {
  return [
    task.scenario_id,
    task.freeze.round_id,
    task.freeze.price_usd,
    task.freeze.updated_at,
    task.freeze.frozen_at,
    task.observation_rule.target_future_rounds,
    task.observation_rule.max_wait_seconds,
    task.observation_rule.poll_seconds,
    task.strategy.capital_usd,
    task.strategy.levels,
    task.strategy.half_width_pct,
    task.strategy.fee_bps,
    task.strategy.slippage_bps,
  ];
}

function taskFromCompactTuple(tuple: unknown): G5GridForwardTask {
  if (!Array.isArray(tuple) || tuple.length !== 13) throw new Error("invalid compact G5 Grid task tuple");
  const [scenarioId, roundId, priceUsd, updatedAt, frozenAt, targetRounds, maxWait, pollSeconds, capitalUsd, levels, halfWidthPct, feeBps, slippageBps] = tuple;
  return G5GridForwardTaskSchema.parse({
    schema: "spondee.grid-forward-observed.task.v1",
    scenario_id: scenarioId,
    evidence_class: "OBSERVED",
    source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_GRID_FEED, feed_description: "BNB / USD" },
    freeze: { round_id: roundId, price_usd: priceUsd, updated_at: updatedAt, frozen_at: frozenAt },
    observation_rule: { only_rounds_after_activation: true, target_future_rounds: targetRounds, max_wait_seconds: maxWait, poll_seconds: pollSeconds },
    strategy: {
      capital_usd: capitalUsd,
      starting_allocation: "50% USD / 50% BNB",
      levels,
      half_width_pct: halfWidthPct,
      fee_bps: feeBps,
      slippage_bps: slippageBps,
      baseline: "STATIC_50_50_BUY_AND_HOLD",
    },
    claim_guardrail: CLAIM_GUARDRAIL,
  });
}

export function encodeG5GridForwardTask(task: G5GridForwardTask): string {
  const parsed = G5GridForwardTaskSchema.parse(task);
  return `${G5_GRID_TASK_PREFIX_V2}${Buffer.from(JSON.stringify(compactTuple(parsed)), "utf8").toString("base64url")}`;
}

export function decodeG5GridForwardTask(value: unknown): G5GridForwardTask | null {
  if (typeof value !== "string") return null;
  try {
    if (value.startsWith(G5_GRID_TASK_PREFIX_V2)) {
      return taskFromCompactTuple(JSON.parse(Buffer.from(value.slice(G5_GRID_TASK_PREFIX_V2.length), "base64url").toString("utf8")));
    }
    if (value.startsWith(G5_GRID_TASK_PREFIX)) {
      return G5GridForwardTaskSchema.parse(JSON.parse(Buffer.from(value.slice(G5_GRID_TASK_PREFIX.length), "base64url").toString("utf8")));
    }
    return null;
  } catch {
    return null;
  }
}

export type G5GridForwardPromise = {
  schema: "spondee.grid-forward-observed-promise.v1";
  promise_id: string;
  scenario_id: string;
  category: "Grid Trading";
  evidence_class: "OBSERVED_PENDING_FORWARD_WINDOW";
  source_feed: typeof G5_GRID_FEED;
  freeze_round_id: string;
  freeze_price_usd: number;
  target_future_rounds: number;
  strategy: G5GridForwardTask["strategy"];
  price_raw: string;
  created_at: string;
  claim_guardrail: string;
};

export type G5GridForwardCommitment = {
  schema: "spondee.grid-forward-observed-commitment.v1";
  promise_id: string;
  scenario_id: string;
  promise_sha256: string;
  price_raw: string;
};

export function buildG5GridForwardPromise(task: G5GridForwardTask, priceRaw: string): G5GridForwardPromise {
  const seed = { scenario_id: task.scenario_id, freeze: task.freeze, observation_rule: task.observation_rule, strategy: task.strategy, price_raw: priceRaw };
  return {
    schema: "spondee.grid-forward-observed-promise.v1",
    promise_id: `spg5_${sha256Hex(seed).slice(0, 24)}`,
    scenario_id: task.scenario_id,
    category: "Grid Trading",
    evidence_class: "OBSERVED_PENDING_FORWARD_WINDOW",
    source_feed: G5_GRID_FEED,
    freeze_round_id: task.freeze.round_id,
    freeze_price_usd: task.freeze.price_usd,
    target_future_rounds: task.observation_rule.target_future_rounds,
    strategy: task.strategy,
    price_raw: priceRaw,
    created_at: task.freeze.frozen_at,
    claim_guardrail: "Promise freezes the Grid configuration before the future observation window. It does not promise profit or realized mainnet execution.",
  };
}

export function buildG5GridForwardCommitment(promise: G5GridForwardPromise): G5GridForwardCommitment {
  return { schema: "spondee.grid-forward-observed-commitment.v1", promise_id: promise.promise_id, scenario_id: promise.scenario_id, promise_sha256: sha256Hex(promise), price_raw: promise.price_raw };
}

export function encodeG5GridForwardCommitment(commitment: G5GridForwardCommitment): string {
  return `${G5_GRID_COMMITMENT_PREFIX}${Buffer.from(JSON.stringify(commitment), "utf8").toString("base64url")}`;
}

export function decodeG5GridForwardCommitment(value: unknown): G5GridForwardCommitment | null {
  if (typeof value !== "string" || !value.startsWith(G5_GRID_COMMITMENT_PREFIX)) return null;
  try {
    const x = JSON.parse(Buffer.from(value.slice(G5_GRID_COMMITMENT_PREFIX.length), "base64url").toString("utf8")) as G5GridForwardCommitment;
    if (x.schema !== "spondee.grid-forward-observed-commitment.v1") return null;
    if (!/^spg5_[0-9a-f]{24}$/.test(x.promise_id)) return null;
    if (!/^[0-9a-f]{64}$/.test(x.promise_sha256)) return null;
    return x;
  } catch {
    return null;
  }
}

function roundNumber(value: number, digits = 8): number { const p = 10 ** digits; return Math.round(value * p) / p; }
function crossedLevel(a: number, b: number, level: number): "UP" | "DOWN" | null { if (a < level && b >= level) return "UP"; if (a > level && b <= level) return "DOWN"; return null; }
function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 0; let max = 0;
  for (const value of equity) { peak = Math.max(peak, value); if (peak > 0) max = Math.max(max, ((peak - value) / peak) * 100); }
  return roundNumber(max, 6);
}

export function evaluateForwardGrid(task: G5GridForwardTask, roundsInput: G5ObservedRound[]): StrategyResult {
  const rounds = roundsInput.map((r) => G5ObservedRoundSchema.parse(r));
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error("insufficient future rounds");
  const unique = new Set(rounds.map((r) => r.round_id));
  if (unique.size !== rounds.length) throw new Error("duplicate observed round");
  for (let i = 1; i < rounds.length; i += 1) {
    if (BigInt(rounds[i]!.round_id) <= BigInt(rounds[i - 1]!.round_id)) throw new Error("round ids are not increasing");
    if (Date.parse(rounds[i]!.updated_at) <= Date.parse(rounds[i - 1]!.updated_at)) throw new Error("round timestamps are not increasing");
  }
  const capital = task.strategy.capital_usd;
  const first = task.freeze.price_usd;
  const lower = first * (1 - task.strategy.half_width_pct / 100);
  const upper = first * (1 + task.strategy.half_width_pct / 100);
  const step = (upper - lower) / (task.strategy.levels - 1);
  const levels = Array.from({ length: task.strategy.levels }, (_, i) => lower + i * step);
  const perFillQuote = capital / (task.strategy.levels * 4);
  const frictionRate = (task.strategy.fee_bps + task.strategy.slippage_bps) / 10_000;
  let cash = capital / 2; let bnb = (capital / 2) / first; let friction = 0; let fills = 0;
  const equity: number[] = [cash + bnb * first]; const intervalPnl: number[] = []; let prev = first;
  for (const r of rounds) {
    const next = r.price_usd;
    const crossed = levels.map((level) => ({ level, direction: crossedLevel(prev, next, level) }))
      .filter((x): x is { level: number; direction: "UP" | "DOWN" } => x.direction !== null)
      .sort((a, b) => next >= prev ? a.level - b.level : b.level - a.level);
    for (const event of crossed) {
      if (event.direction === "DOWN") {
        const quote = Math.min(perFillQuote, cash / (1 + frictionRate)); if (quote <= 0) continue;
        const cost = quote * frictionRate; cash -= quote + cost; bnb += quote / event.level; friction += cost; fills += 1;
      } else {
        const units = Math.min(perFillQuote / event.level, bnb); if (units <= 0) continue;
        const gross = units * event.level; const cost = gross * frictionRate; cash += gross - cost; bnb -= units; friction += cost; fills += 1;
      }
    }
    const current = cash + bnb * next; const prior = equity[equity.length - 1]!; intervalPnl.push(current - prior); equity.push(current); prev = next;
  }
  const terminal = equity[equity.length - 1]!;
  const netReturn = ((terminal / capital) - 1) * 100;
  const grossReturn = netReturn + (friction / capital) * 100;
  const epsilon = 1e-8;
  const wins = intervalPnl.filter((v) => v > epsilon).length;
  const losses = intervalPnl.filter((v) => v < -epsilon).length;
  const flat = intervalPnl.length - wins - losses;
  return {
    strategy: "bounded_symmetric_paper_grid_on_forward_chainlink_path",
    initial_equity_usd: capital,
    terminal_equity_usd: roundNumber(terminal, 6),
    gross_return_pct: roundNumber(grossReturn, 6),
    net_return_pct: roundNumber(netReturn, 6),
    max_drawdown_pct: maxDrawdown(equity),
    estimated_execution_friction_usd: roundNumber(friction, 6),
    fill_count: fills, wins, losses, flat,
    final_cash_usd: roundNumber(cash, 6), final_bnb: roundNumber(bnb, 10),
    parameters: {
      capital_usd: capital,
      starting_allocation: task.strategy.starting_allocation,
      levels: task.strategy.levels,
      lower_price: roundNumber(lower, 8), upper_price: roundNumber(upper, 8),
      half_width_pct: task.strategy.half_width_pct, fee_bps: task.strategy.fee_bps, slippage_bps: task.strategy.slippage_bps,
      per_fill_quote_usd: roundNumber(perFillQuote, 6), configuration_basis: "pre-window freeze round only", no_lookahead_configuration: true,
    },
  };
}

export function evaluateForwardBaseline(task: G5GridForwardTask, roundsInput: G5ObservedRound[]): StrategyResult {
  const rounds = roundsInput.map((r) => G5ObservedRoundSchema.parse(r));
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error("insufficient future rounds");
  const capital = task.strategy.capital_usd; const first = task.freeze.price_usd;
  const cash = capital / 2; const bnb = (capital / 2) / first;
  const equity = [capital, ...rounds.map((r) => cash + bnb * r.price_usd)];
  const terminal = equity.at(-1)!;
  const intervalPnl = equity.slice(1).map((value, i) => value - equity[i]!);
  const epsilon = 1e-8;
  const wins = intervalPnl.filter((v) => v > epsilon).length;
  const losses = intervalPnl.filter((v) => v < -epsilon).length;
  const flat = intervalPnl.length - wins - losses;
  const ret = ((terminal / capital) - 1) * 100;
  return {
    strategy: "bounded_symmetric_paper_grid_on_forward_chainlink_path",
    initial_equity_usd: capital,
    terminal_equity_usd: roundNumber(terminal, 6), gross_return_pct: roundNumber(ret, 6), net_return_pct: roundNumber(ret, 6),
    max_drawdown_pct: maxDrawdown(equity), estimated_execution_friction_usd: 0, fill_count: 0, wins, losses, flat,
    final_cash_usd: cash, final_bnb: roundNumber(bnb, 10),
    parameters: { capital_usd: capital, starting_allocation: task.strategy.starting_allocation, baseline: task.strategy.baseline, rebalance_or_grid_actions: 0 },
  };
}

export function assertForwardObservationAfterActivation(task: G5GridForwardTask, rounds: G5ObservedRound[], activationFundedAt: string): void {
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error("insufficient forward rounds");
  const first = rounds[0]!;
  if (BigInt(first.round_id) <= BigInt(task.freeze.round_id)) throw new Error("first observed round does not follow the freeze round");
  if (Date.parse(first.updated_at) <= Date.parse(task.freeze.frozen_at)) throw new Error("first observed round does not follow promise freeze");
  if (Date.parse(first.updated_at) <= Date.parse(activationFundedAt)) throw new Error("first observed round does not follow marketplace funding");
}
