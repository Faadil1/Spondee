import { createHash } from "node:crypto";
import { loadStudioToml } from "@bnbagent/studio-runtime/config";
import { z } from "zod";

export const SPONDEE_PROMISE_COMMITMENT_PREFIX = "SPONDEE_PROMISE_COMMITMENT_V1:";
export const SPONDEE_TASK_B64_PREFIX = "SPONDEE_TASK_B64_V1:";

type AgentKind = "grid" | "rebalancing" | "yield";
type Category = "Grid Trading" | "Rebalancing" | "Yield Optimisation";

const TimedPriceSchema = z.object({
  at_seconds: z.number().int().nonnegative(),
  price: z.number().positive(),
});

export const GridTaskSchema = z.object({
  schema: z.literal("spondee.grid.task.v1"),
  scenario_id: z.string().min(1).max(128),
  evidence_class: z.literal("SIMULATION"),
  capital_usd: z.number().positive(),
  lower_price: z.number().positive(),
  upper_price: z.number().positive(),
  levels: z.number().int().min(2).max(50),
  fee_bps: z.number().nonnegative().max(1000).default(10),
  slippage_bps: z.number().nonnegative().max(1000).default(5),
  declared_price_path: z.array(TimedPriceSchema).min(2),
}).refine((v) => v.upper_price > v.lower_price, {
  message: "upper_price must be greater than lower_price",
  path: ["upper_price"],
});

export const RebalancingTaskSchema = z.object({
  schema: z.literal("spondee.rebalancing.task.v1"),
  scenario_id: z.string().min(1).max(128),
  evidence_class: z.literal("SIMULATION"),
  position: z.object({
    capital_usd: z.number().positive(),
    lower_price: z.number().positive(),
    upper_price: z.number().positive(),
  }),
  target_width_bps: z.number().positive().max(10000),
  reset_latency_seconds: z.number().int().nonnegative(),
  estimated_reset_cost_usd: z.number().nonnegative(),
  declared_price_path: z.array(TimedPriceSchema).min(2),
}).refine((v) => v.position.upper_price > v.position.lower_price, {
  message: "position.upper_price must exceed position.lower_price",
  path: ["position", "upper_price"],
});

const YieldOptionSchema = z.object({
  id: z.string().min(1).max(128),
  gross_apr_pct: z.number().finite(),
  risk_score: z.number().min(0).max(100),
  switch_cost_usd: z.number().nonnegative().default(0),
});

export const YieldTaskSchema = z.object({
  schema: z.literal("spondee.yield.task.v1"),
  scenario_id: z.string().min(1).max(128),
  evidence_class: z.literal("SIMULATION"),
  capital_usd: z.number().positive(),
  horizon_days: z.number().positive().max(3650),
  max_risk_score: z.number().min(0).max(100),
  current: YieldOptionSchema,
  candidates: z.array(YieldOptionSchema).min(1).max(50),
});

export type GridTask = z.infer<typeof GridTaskSchema>;
export type RebalancingTask = z.infer<typeof RebalancingTaskSchema>;
export type YieldTask = z.infer<typeof YieldTaskSchema>;
export type CategoryTask = GridTask | RebalancingTask | YieldTask;

export interface CategoryPromiseCard {
  schema: "spondee.promise-card.v1";
  category: Category;
  promise_id: string;
  scenario_id: string;
  evidence_class: "SIMULATION";
  expected_outcome: string;
  confidence: null;
  confidence_status: "UNSCORED_UNTIL_OBSERVED_CALIBRATION";
  expected_downside: Record<string, unknown>;
  expected_cost: { currency: "raw_erc8183_wei"; amount: string; source: "fixed_studio_list_price" };
  timing: Record<string, unknown>;
  methodology: Record<string, unknown>;
  claim_guardrail: string;
}

export interface CategoryPromiseCommitment {
  schema: "spondee.promise-commitment.v1";
  promise_id: string;
  scenario_id: string;
  price_raw: string;
  promise_sha256: string;
}

export interface CategoryOutcomeReceipt {
  schema: "spondee.outcome-receipt.v1";
  category: Category;
  promise_id: string;
  scenario_id: string;
  evidence_class: "SIMULATION";
  outcome: Record<string, unknown>;
  calibration: { eligible_for_observed_agent_advantage: false; status: "NOT_OBSERVED_MARKET_EVIDENCE" };
  claim_guardrail: string;
}

function projectName(): string {
  const cfg = loadStudioToml();
  return String(((cfg.project ?? {}) as Record<string, unknown>).name ?? "").toLowerCase();
}

export function currentAgentKind(): AgentKind {
  const name = projectName();
  if (name.includes("grid")) return "grid";
  if (name.includes("rebalanc")) return "rebalancing";
  if (name.includes("yield")) return "yield";
  throw new Error(`unsupported Spondee category agent project name: ${name || "<empty>"}`);
}

export function currentAgentMetadata(): { kind: AgentKind; category: Category; taskSchema: string; label: string } {
  const kind = currentAgentKind();
  if (kind === "grid") return { kind, category: "Grid Trading", taskSchema: "spondee.grid.task.v1", label: "Spondee Grid" };
  if (kind === "rebalancing") return { kind, category: "Rebalancing", taskSchema: "spondee.rebalancing.task.v1", label: "Spondee Rebalancing" };
  return { kind, category: "Yield Optimisation", taskSchema: "spondee.yield.task.v1", label: "Spondee Yield" };
}

function round(value: number, digits = 4): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed.startsWith(SPONDEE_TASK_B64_PREFIX)) {
    try {
      return JSON.parse(Buffer.from(trimmed.slice(SPONDEE_TASK_B64_PREFIX.length), "base64url").toString("utf8"));
    } catch { return value; }
  }
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

export function parseCategoryTask(value: unknown): CategoryTask | null {
  const raw = parseMaybeJson(value);
  const kind = currentAgentKind();
  const parsed = kind === "grid"
    ? GridTaskSchema.safeParse(raw)
    : kind === "rebalancing"
      ? RebalancingTaskSchema.safeParse(raw)
      : YieldTaskSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function encodeCategoryTaskForChain(task: CategoryTask): string {
  return `${SPONDEE_TASK_B64_PREFIX}${Buffer.from(JSON.stringify(task), "utf8").toString("base64url")}`;
}

function crossingTime(points: Array<{ at_seconds: number; value: number }>, threshold: number, mode: "lte" | "gte"): number | null {
  const sorted = [...points].sort((a, b) => a.at_seconds - b.at_seconds);
  const hit = (v: number) => mode === "lte" ? v <= threshold : v >= threshold;
  if (hit(sorted[0].value)) return sorted[0].at_seconds;
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1]; const b = sorted[i];
    if (!hit(a.value) && hit(b.value)) {
      const delta = b.value - a.value;
      const fraction = delta === 0 ? 1 : (threshold - a.value) / delta;
      return round(a.at_seconds + fraction * (b.at_seconds - a.at_seconds), 2);
    }
  }
  return null;
}

function priceAt(points: Array<{ at_seconds: number; price: number }>, t: number): number {
  const sorted = [...points].sort((a, b) => a.at_seconds - b.at_seconds);
  if (t <= sorted[0].at_seconds) return sorted[0].price;
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1]; const b = sorted[i];
    if (t <= b.at_seconds) {
      const span = b.at_seconds - a.at_seconds;
      const fraction = span === 0 ? 1 : (t - a.at_seconds) / span;
      return a.price + fraction * (b.price - a.price);
    }
  }
  return sorted.at(-1)!.price;
}

export function analyzeCategoryTask(task: CategoryTask): Record<string, unknown> {
  if (task.schema === "spondee.grid.task.v1") {
    const path = [...task.declared_price_path].sort((a, b) => a.at_seconds - b.at_seconds);
    const step = (task.upper_price - task.lower_price) / (task.levels - 1);
    const levels = Array.from({ length: task.levels }, (_, i) => task.lower_price + i * step);
    const crossed = new Set<number>();
    for (let i = 1; i < path.length; i += 1) {
      const lo = Math.min(path[i - 1].price, path[i].price);
      const hi = Math.max(path[i - 1].price, path[i].price);
      levels.forEach((level, index) => { if (level >= lo && level <= hi) crossed.add(index); });
    }
    const values = path.map((p) => ({ at_seconds: p.at_seconds, value: p.price }));
    const breaks = [crossingTime(values, task.lower_price, "lte"), crossingTime(values, task.upper_price, "gte")]
      .filter((x): x is number => x !== null);
    return {
      projected_grid_levels_crossed: crossed.size,
      projected_range_break_seconds: breaks.length ? Math.min(...breaks) : null,
      minimum_declared_price: round(Math.min(...path.map((p) => p.price))),
      maximum_declared_price: round(Math.max(...path.map((p) => p.price))),
      estimated_execution_cost_bps_per_fill: round(task.fee_bps + task.slippage_bps, 2),
    };
  }
  if (task.schema === "spondee.rebalancing.task.v1") {
    const path = [...task.declared_price_path].sort((a, b) => a.at_seconds - b.at_seconds);
    const values = path.map((p) => ({ at_seconds: p.at_seconds, value: p.price }));
    const exits = [crossingTime(values, task.position.lower_price, "lte"), crossingTime(values, task.position.upper_price, "gte")]
      .filter((x): x is number => x !== null);
    const firstExit = exits.length ? Math.min(...exits) : null;
    const resetAt = firstExit === null ? null : firstExit + task.reset_latency_seconds;
    const resetPrice = resetAt === null ? null : priceAt(path, resetAt);
    const halfWidth = task.target_width_bps / 20000;
    return {
      projected_out_of_range: firstExit !== null,
      first_out_of_range_seconds: firstExit,
      projected_reset_seconds: resetAt,
      projected_time_out_of_range_seconds: firstExit === null ? 0 : task.reset_latency_seconds,
      projected_reset_price: resetPrice === null ? null : round(resetPrice),
      projected_new_range: resetPrice === null ? null : {
        lower_price: round(resetPrice * (1 - halfWidth)),
        upper_price: round(resetPrice * (1 + halfWidth)),
      },
      estimated_reset_cost_usd: round(task.estimated_reset_cost_usd, 2),
    };
  }
  const net = (apr: number, cost: number) => task.capital_usd * (apr / 100) * (task.horizon_days / 365) - cost;
  const currentNet = net(task.current.gross_apr_pct, 0);
  const eligible = task.candidates
    .filter((c) => c.risk_score <= task.max_risk_score)
    .map((c) => ({ ...c, projected: net(c.gross_apr_pct, c.switch_cost_usd) }))
    .sort((a, b) => b.projected - a.projected);
  const best = eligible[0] ?? null;
  const rotate = best !== null && best.projected > currentNet;
  return {
    selected_option_id: rotate ? best!.id : task.current.id,
    rotation_recommended: rotate,
    current_projected_net_horizon_usd: round(currentNet, 2),
    selected_projected_net_horizon_usd: round(rotate ? best!.projected : currentNet, 2),
    projected_net_horizon_uplift_usd: round(rotate ? best!.projected - currentNet : 0, 2),
    selected_risk_score: rotate ? best!.risk_score : task.current.risk_score,
    eligible_candidate_count: eligible.length,
  };
}

function narrative(task: CategoryTask, a: Record<string, unknown>): string {
  if (task.schema === "spondee.grid.task.v1") return `Evaluate ${task.levels} declared grid levels and surface range-break/execution-cost conditions for scenario ${task.scenario_id}; no profit is promised.`;
  if (task.schema === "spondee.rebalancing.task.v1") return a.projected_out_of_range
    ? `Detect the declared LP range exit and produce a bounded reset plan after ${task.reset_latency_seconds}s latency in scenario ${task.scenario_id}.`
    : `Keep the declared LP range unchanged unless scenario ${task.scenario_id} exits its bounds.`;
  return a.rotation_recommended
    ? `Select the highest projected net-horizon option within the declared risk limit for scenario ${task.scenario_id}, after switch costs.`
    : `Retain the current yield option because no eligible declared candidate improves projected net-horizon return.`;
}

function downside(task: CategoryTask, a: Record<string, unknown>): Record<string, unknown> {
  if (task.schema === "spondee.grid.task.v1") return { range_break_projected: a.projected_range_break_seconds !== null, projected_range_break_seconds: a.projected_range_break_seconds, no_pnl_guarantee: true };
  if (task.schema === "spondee.rebalancing.task.v1") return { out_of_range_projected: a.projected_out_of_range, projected_time_out_of_range_seconds: a.projected_time_out_of_range_seconds, estimated_reset_cost_usd: task.estimated_reset_cost_usd };
  return { selected_risk_score: a.selected_risk_score, max_risk_score: task.max_risk_score, switch_costs_included: true, yield_not_guaranteed: true };
}

function timing(task: CategoryTask, a: Record<string, unknown>): Record<string, unknown> {
  if (task.schema === "spondee.grid.task.v1") return { projected_range_break_seconds: a.projected_range_break_seconds };
  if (task.schema === "spondee.rebalancing.task.v1") return { first_out_of_range_seconds: a.first_out_of_range_seconds, projected_reset_seconds: a.projected_reset_seconds };
  return { evaluation_horizon_days: task.horizon_days };
}

function methodology(task: CategoryTask): Record<string, unknown> {
  if (task.schema === "spondee.grid.task.v1") return { model: "deterministic_declared_price_path_grid_crossings", pnl_model: "NONE", calibration_history: "INSUFFICIENT_HISTORY" };
  if (task.schema === "spondee.rebalancing.task.v1") return { model: "deterministic_declared_price_path_range_exit", reset_policy: "bounded_latency_recenter", calibration_history: "INSUFFICIENT_HISTORY" };
  return { model: "declared_apr_minus_amortized_switch_cost", risk_filter: "hard_max_risk_score", calibration_history: "INSUFFICIENT_HISTORY" };
}

export function buildCategoryPromise(task: CategoryTask, priceWei: bigint): CategoryPromiseCard {
  const meta = currentAgentMetadata();
  const a = analyzeCategoryTask(task);
  return {
    schema: "spondee.promise-card.v1",
    category: meta.category,
    promise_id: `sp_${digest({ task, price_wei: String(priceWei) }).slice(0, 24)}`,
    scenario_id: task.scenario_id,
    evidence_class: "SIMULATION",
    expected_outcome: narrative(task, a),
    confidence: null,
    confidence_status: "UNSCORED_UNTIL_OBSERVED_CALIBRATION",
    expected_downside: downside(task, a),
    expected_cost: { currency: "raw_erc8183_wei", amount: String(priceWei), source: "fixed_studio_list_price" },
    timing: timing(task, a),
    methodology: methodology(task),
    claim_guardrail: "Simulation only. This Promise Card is not observed performance evidence and does not guarantee profit, yield or execution quality.",
  };
}

export function hashCategoryPromise(promise: CategoryPromiseCard): string { return digest(promise); }

export function buildCategoryPromiseCommitment(promise: CategoryPromiseCard): CategoryPromiseCommitment {
  return { schema: "spondee.promise-commitment.v1", promise_id: promise.promise_id, scenario_id: promise.scenario_id, price_raw: promise.expected_cost.amount, promise_sha256: hashCategoryPromise(promise) };
}

export function encodeCategoryPromiseCommitmentCriterion(promise: CategoryPromiseCard): string {
  const c = buildCategoryPromiseCommitment(promise);
  return `${SPONDEE_PROMISE_COMMITMENT_PREFIX}${JSON.stringify({ p: c.promise_id, s: c.scenario_id, r: c.price_raw, h: c.promise_sha256 })}`;
}

export function decodeCategoryPromiseCommitmentCriterion(value: unknown): CategoryPromiseCommitment | null {
  if (typeof value !== "string" || !value.startsWith(SPONDEE_PROMISE_COMMITMENT_PREFIX)) return null;
  try {
    const c = JSON.parse(value.slice(SPONDEE_PROMISE_COMMITMENT_PREFIX.length)) as Record<string, unknown>;
    if (typeof c.p !== "string" || typeof c.s !== "string" || typeof c.r !== "string" || !/^\d+$/.test(c.r) || typeof c.h !== "string" || !/^[a-f0-9]{64}$/.test(c.h)) return null;
    return { schema: "spondee.promise-commitment.v1", promise_id: c.p, scenario_id: c.s, price_raw: c.r, promise_sha256: c.h };
  } catch { return null; }
}

function taskFromEnvelope(data: Record<string, unknown>): CategoryTask | null { return parseCategoryTask(data.task ?? data.task_description); }

export function previewHealthFactorFromEnvelope(data: Record<string, unknown>, priceWei: bigint): CategoryPromiseCard | null {
  const task = taskFromEnvelope(data);
  return task === null ? null : buildCategoryPromise(task, priceWei);
}

export function enrichHealthFactorNegotiation(request: Record<string, unknown>, priceWei: bigint): { request: Record<string, unknown>; promise: CategoryPromiseCard | null; commitment: CategoryPromiseCommitment | null } {
  const task = taskFromEnvelope(request);
  if (task === null) return { request, promise: null, commitment: null };
  const promise = buildCategoryPromise(task, priceWei);
  const commitment = buildCategoryPromiseCommitment(promise);
  const terms = request.terms !== null && typeof request.terms === "object" && !Array.isArray(request.terms) ? request.terms as Record<string, unknown> : {};
  const existing = Array.isArray(terms.success_criteria) ? terms.success_criteria.filter((x): x is string => typeof x === "string" && !x.startsWith(SPONDEE_PROMISE_COMMITMENT_PREFIX)) : [];
  return { request: { ...request, terms: { ...terms, success_criteria: [...existing, encodeCategoryPromiseCommitmentCriterion(promise)] } }, promise, commitment };
}

function termsCommitment(value: unknown): CategoryPromiseCommitment | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const terms = value as Record<string, unknown>;
  if (!Array.isArray(terms.success_criteria)) return null;
  const matches = terms.success_criteria.map(decodeCategoryPromiseCommitmentCriterion).filter((x): x is CategoryPromiseCommitment => x !== null);
  return matches.length === 1 ? matches[0] : null;
}

export function buildHealthFactorOutcomeFromWorkPrompt(prompt: string): CategoryOutcomeReceipt | null {
  const marker = "JOB CONTEXT:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) return null;
  let context: unknown;
  try { context = JSON.parse(prompt.slice(index + marker.length).trim()); } catch { return null; }
  if (context === null || typeof context !== "object" || Array.isArray(context)) return null;
  const job = context as Record<string, unknown>;
  const task = parseCategoryTask(job.task);
  const commitment = termsCommitment(job.terms);
  if (task === null || commitment === null || commitment.scenario_id !== task.scenario_id) return null;
  let priceWei: bigint;
  try { priceWei = BigInt(commitment.price_raw); } catch { return null; }
  const promise = buildCategoryPromise(task, priceWei);
  if (promise.promise_id !== commitment.promise_id || hashCategoryPromise(promise) !== commitment.promise_sha256) return null;
  return {
    schema: "spondee.outcome-receipt.v1",
    category: promise.category,
    promise_id: promise.promise_id,
    scenario_id: task.scenario_id,
    evidence_class: "SIMULATION",
    outcome: analyzeCategoryTask(task),
    calibration: { eligible_for_observed_agent_advantage: false, status: "NOT_OBSERVED_MARKET_EVIDENCE" },
    claim_guardrail: "This receipt proves deterministic Promise-to-Outcome plumbing for declared simulation inputs only. It is excluded from observed Agent Advantage.",
  };
}

export function demoTaskForCurrentAgent(): CategoryTask {
  const kind = currentAgentKind();
  if (kind === "grid") return {
    schema: "spondee.grid.task.v1", scenario_id: "spondee-grid-demo-001", evidence_class: "SIMULATION", capital_usd: 10000,
    lower_price: 580, upper_price: 620, levels: 5, fee_bps: 10, slippage_bps: 5,
    declared_price_path: [{ at_seconds: 0, price: 600 }, { at_seconds: 120, price: 610 }, { at_seconds: 240, price: 624 }],
  };
  if (kind === "rebalancing") return {
    schema: "spondee.rebalancing.task.v1", scenario_id: "spondee-rebalancing-demo-001", evidence_class: "SIMULATION",
    position: { capital_usd: 10000, lower_price: 580, upper_price: 620 }, target_width_bps: 600, reset_latency_seconds: 60, estimated_reset_cost_usd: 4,
    declared_price_path: [{ at_seconds: 0, price: 600 }, { at_seconds: 180, price: 625 }, { at_seconds: 300, price: 630 }],
  };
  return {
    schema: "spondee.yield.task.v1", scenario_id: "spondee-yield-demo-001", evidence_class: "SIMULATION", capital_usd: 10000, horizon_days: 30, max_risk_score: 45,
    current: { id: "current", gross_apr_pct: 5, risk_score: 20, switch_cost_usd: 0 },
    candidates: [{ id: "candidate-a", gross_apr_pct: 8, risk_score: 35, switch_cost_usd: 2 }, { id: "candidate-high-risk", gross_apr_pct: 20, risk_score: 80, switch_cost_usd: 1 }],
  };
}
