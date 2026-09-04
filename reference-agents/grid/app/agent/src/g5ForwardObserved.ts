import { createHash } from "node:crypto";
import { createPublicClient, getAddress, http } from "viem";
import { z } from "zod";

export const G5_GRID_FEED = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" as const;
export const G5_GRID_TASK_PREFIX = "SPONDEE_G5_GRID_FORWARD_TASK_B64_V1:";
export const G5_GRID_COMMITMENT_PREFIX = "SPONDEE_G5_GRID_FORWARD_COMMITMENT_V1:";
const RPC = () => process.env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org";

const taskSchema = z.object({
  schema: z.literal("spondee.grid-forward-observed.task.v1"),
  scenario_id: z.string().min(1).max(160),
  evidence_class: z.literal("OBSERVED"),
  source: z.object({
    chain_id: z.literal(56), network: z.literal("bsc-mainnet"), feed_address: z.literal(G5_GRID_FEED), feed_description: z.literal("BNB / USD"),
  }),
  freeze: z.object({
    round_id: z.string().regex(/^\d+$/), price_usd: z.number().positive(), updated_at: z.string().datetime(), frozen_at: z.string().datetime(),
  }),
  observation_rule: z.object({
    only_rounds_after_activation: z.literal(true), target_future_rounds: z.number().int().min(5).max(20), max_wait_seconds: z.number().int().min(120).max(900), poll_seconds: z.number().int().min(2).max(30),
  }),
  strategy: z.object({
    capital_usd: z.number().positive(), starting_allocation: z.literal("50% USD / 50% BNB"), levels: z.number().int().min(3).max(25), half_width_pct: z.number().positive().max(10), fee_bps: z.number().nonnegative().max(1000), slippage_bps: z.number().nonnegative().max(1000), baseline: z.literal("STATIC_50_50_BUY_AND_HOLD"),
  }),
  claim_guardrail: z.string().min(1),
});
export type ForwardTask = z.infer<typeof taskSchema>;

export type ForwardRound = { round_id: string; price_usd: number; updated_at: string };

const abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ] },
  { type: "function", name: "getRoundData", stateMutability: "view", inputs: [{ name: "_roundId", type: "uint80" }], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ] },
] as const;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function digest(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex"); }
function roundNumber(value: number, digits = 8): number { const p = 10 ** digits; return Math.round(value * p) / p; }

export function decodeForwardTask(value: unknown): ForwardTask | null {
  if (typeof value !== "string" || !value.startsWith(G5_GRID_TASK_PREFIX)) return null;
  try { return taskSchema.parse(JSON.parse(Buffer.from(value.slice(G5_GRID_TASK_PREFIX.length), "base64url").toString("utf8"))); }
  catch { return null; }
}

export type ForwardPromise = {
  schema: "spondee.grid-forward-observed-promise.v1";
  promise_id: string;
  scenario_id: string;
  category: "Grid Trading";
  evidence_class: "OBSERVED_PENDING_FORWARD_WINDOW";
  source_feed: typeof G5_GRID_FEED;
  freeze_round_id: string;
  freeze_price_usd: number;
  target_future_rounds: number;
  strategy: ForwardTask["strategy"];
  price_raw: string;
  created_at: string;
  claim_guardrail: string;
};

export function buildForwardPromise(task: ForwardTask, priceRaw: string): ForwardPromise {
  const seed = { scenario_id: task.scenario_id, freeze: task.freeze, observation_rule: task.observation_rule, strategy: task.strategy, price_raw: priceRaw };
  return {
    schema: "spondee.grid-forward-observed-promise.v1",
    promise_id: `spg5_${digest(seed).slice(0, 24)}`,
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

export function commitmentForPromise(promise: ForwardPromise) {
  return {
    schema: "spondee.grid-forward-observed-commitment.v1",
    promise_id: promise.promise_id,
    scenario_id: promise.scenario_id,
    promise_sha256: digest(promise),
    price_raw: promise.price_raw,
  } as const;
}

export function encodeCommitment(promise: ForwardPromise): string {
  return `${G5_GRID_COMMITMENT_PREFIX}${Buffer.from(JSON.stringify(commitmentForPromise(promise)), "utf8").toString("base64url")}`;
}

export function commitmentFromTerms(terms: unknown) {
  if (terms === null || typeof terms !== "object" || Array.isArray(terms)) return null;
  const criteria = (terms as Record<string, unknown>).success_criteria;
  if (!Array.isArray(criteria)) return null;
  const matches = criteria.filter((x): x is string => typeof x === "string" && x.startsWith(G5_GRID_COMMITMENT_PREFIX));
  if (matches.length !== 1) return null;
  try { return JSON.parse(Buffer.from(matches[0].slice(G5_GRID_COMMITMENT_PREFIX.length), "base64url").toString("utf8")) as ReturnType<typeof commitmentForPromise>; }
  catch { return null; }
}

function crossedLevel(a: number, b: number, level: number): "UP" | "DOWN" | null {
  if (a < level && b >= level) return "UP";
  if (a > level && b <= level) return "DOWN";
  return null;
}
function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 0; let max = 0;
  for (const value of equity) { peak = Math.max(peak, value); if (peak > 0) max = Math.max(max, ((peak - value) / peak) * 100); }
  return roundNumber(max, 6);
}

export function evaluateForwardGrid(task: ForwardTask, rounds: ForwardRound[]) {
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error("insufficient forward rounds");
  const capital = task.strategy.capital_usd;
  const first = task.freeze.price_usd;
  const lower = first * (1 - task.strategy.half_width_pct / 100);
  const upper = first * (1 + task.strategy.half_width_pct / 100);
  const step = (upper - lower) / (task.strategy.levels - 1);
  const levels = Array.from({ length: task.strategy.levels }, (_, i) => lower + i * step);
  const perFillQuote = capital / (task.strategy.levels * 4);
  const frictionRate = (task.strategy.fee_bps + task.strategy.slippage_bps) / 10_000;
  let cash = capital / 2; let bnb = (capital / 2) / first; let friction = 0; let fills = 0;
  const equity = [capital]; const intervalPnl: number[] = []; let prev = first;
  for (const r of rounds) {
    const crossed = levels.map((level) => ({ level, direction: crossedLevel(prev, r.price_usd, level) }))
      .filter((x): x is { level: number; direction: "UP" | "DOWN" } => x.direction !== null)
      .sort((a, b) => r.price_usd >= prev ? a.level - b.level : b.level - a.level);
    for (const event of crossed) {
      if (event.direction === "DOWN") {
        const quote = Math.min(perFillQuote, cash / (1 + frictionRate)); if (quote <= 0) continue;
        const cost = quote * frictionRate; cash -= quote + cost; bnb += quote / event.level; friction += cost; fills += 1;
      } else {
        const units = Math.min(perFillQuote / event.level, bnb); if (units <= 0) continue;
        const gross = units * event.level; const cost = gross * frictionRate; cash += gross - cost; bnb -= units; friction += cost; fills += 1;
      }
    }
    const current = cash + bnb * r.price_usd; const prior = equity.at(-1)!; intervalPnl.push(current - prior); equity.push(current); prev = r.price_usd;
  }
  const terminal = equity.at(-1)!; const netReturn = ((terminal / capital) - 1) * 100; const grossReturn = netReturn + (friction / capital) * 100;
  const eps = 1e-8; const wins = intervalPnl.filter((v) => v > eps).length; const losses = intervalPnl.filter((v) => v < -eps).length;
  return {
    strategy: "bounded_symmetric_paper_grid_on_forward_chainlink_path",
    initial_equity_usd: capital,
    terminal_equity_usd: roundNumber(terminal, 6),
    gross_return_pct: roundNumber(grossReturn, 6),
    net_return_pct: roundNumber(netReturn, 6),
    max_drawdown_pct: maxDrawdown(equity),
    estimated_execution_friction_usd: roundNumber(friction, 6),
    fill_count: fills,
    wins, losses, flat: intervalPnl.length - wins - losses,
    final_cash_usd: roundNumber(cash, 6), final_bnb: roundNumber(bnb, 10),
    parameters: { capital_usd: capital, starting_allocation: task.strategy.starting_allocation, levels: task.strategy.levels, lower_price: roundNumber(lower, 8), upper_price: roundNumber(upper, 8), half_width_pct: task.strategy.half_width_pct, fee_bps: task.strategy.fee_bps, slippage_bps: task.strategy.slippage_bps, per_fill_quote_usd: roundNumber(perFillQuote, 6), configuration_basis: "pre-window freeze round only", no_lookahead_configuration: true },
  };
}

async function readRound(client: ReturnType<typeof createPublicClient>, decimals: number, roundId: bigint): Promise<ForwardRound | null> {
  try {
    const r = await client.readContract({ address: getAddress(G5_GRID_FEED), abi, functionName: "getRoundData", args: [roundId] });
    const [observedRoundId, answer, , updatedAt] = r;
    if (answer <= 0n || updatedAt <= 0n) return null;
    return { round_id: observedRoundId.toString(), price_usd: Number(answer) / 10 ** decimals, updated_at: new Date(Number(updatedAt) * 1000).toISOString() };
  } catch { return null; }
}

export async function observeForwardRounds(task: ForwardTask, observationStartedAt = new Date().toISOString()): Promise<ForwardRound[]> {
  const client = createPublicClient({ transport: http(RPC(), { timeout: 15_000 }) });
  if (await client.getChainId() !== 56) throw new Error("forward Grid source is not BSC mainnet");
  const [decimals, description] = await Promise.all([
    client.readContract({ address: getAddress(G5_GRID_FEED), abi, functionName: "decimals" }),
    client.readContract({ address: getAddress(G5_GRID_FEED), abi, functionName: "description" }),
  ]);
  if (!String(description).toUpperCase().includes("BNB")) throw new Error(`unexpected feed description: ${description}`);
  const deadline = Date.now() + task.observation_rule.max_wait_seconds * 1000;
  const rounds: ForwardRound[] = [];
  let cursor = BigInt(task.freeze.round_id) + 1n;
  const seen = new Set<string>();

  while (Date.now() < deadline && rounds.length < task.observation_rule.target_future_rounds) {
    const latest = await client.readContract({ address: getAddress(G5_GRID_FEED), abi, functionName: "latestRoundData" });
    const latestId = latest[0];
    while (cursor <= latestId && rounds.length < task.observation_rule.target_future_rounds) {
      const r = await readRound(client, Number(decimals), cursor);
      cursor += 1n;
      if (r === null || seen.has(r.round_id)) continue;
      if (Date.parse(r.updated_at) <= Date.parse(observationStartedAt)) continue;
      seen.add(r.round_id); rounds.push(r);
    }
    if (rounds.length < task.observation_rule.target_future_rounds) {
      await new Promise((resolve) => setTimeout(resolve, task.observation_rule.poll_seconds * 1000));
    }
  }
  if (rounds.length < task.observation_rule.target_future_rounds) throw new Error(`timed out with ${rounds.length}/${task.observation_rule.target_future_rounds} future rounds`);
  return rounds;
}

export async function executeForwardObservedTask(task: ForwardTask, promise: ForwardPromise) {
  const observationStartedAt = new Date().toISOString();
  const rounds = await observeForwardRounds(task, observationStartedAt);
  const output = evaluateForwardGrid(task, rounds);
  const observationCompletedAt = new Date().toISOString();
  return {
    schema: "spondee.grid-forward-observed-agent-output.v1",
    scenario_id: task.scenario_id,
    promise_id: promise.promise_id,
    observation_started_at: observationStartedAt,
    observation_completed_at: observationCompletedAt,
    rounds,
    strategy_result: output,
    wallet_used_for_market_data: false,
    mainnet_chain_write_attempted: false,
    realized_mainnet_pnl_claimed: false,
    claim_guardrail: "Observed BNB/USD rounds drive paper Grid accounting only; no BNB mainnet trade occurred and no realized PnL is claimed.",
  } as const;
}
