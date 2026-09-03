import { createHash } from "node:crypto";
import type {
  Category,
  OutcomeReceipt,
  PromiseCard,
  SpondeeTask,
} from "./contracts.js";

function round(value: number, digits = 4): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

export function taskCategory(task: SpondeeTask): Category {
  switch (task.schema) {
    case "spondee.health-factor.task.v1":
      return "Health Factor Monitoring";
    case "spondee.grid.task.v1":
      return "Grid Trading";
    case "spondee.rebalancing.task.v1":
      return "Rebalancing";
    case "spondee.yield.task.v1":
      return "Yield Optimisation";
  }
}

function crossingTime(
  points: Array<{ at_seconds: number; value: number }>,
  threshold: number,
  mode: "lte" | "gte",
): number | null {
  const sorted = [...points].sort((a, b) => a.at_seconds - b.at_seconds);
  const hit = (value: number) => (mode === "lte" ? value <= threshold : value >= threshold);
  if (hit(sorted[0].value)) return sorted[0].at_seconds;

  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (!hit(a.value) && hit(b.value)) {
      const delta = b.value - a.value;
      const fraction = delta === 0 ? 1 : (threshold - a.value) / delta;
      return round(a.at_seconds + fraction * (b.at_seconds - a.at_seconds), 2);
    }
  }
  return null;
}

function priceAt(
  points: Array<{ at_seconds: number; price: number }>,
  atSeconds: number,
): number {
  const sorted = [...points].sort((a, b) => a.at_seconds - b.at_seconds);
  if (atSeconds <= sorted[0].at_seconds) return sorted[0].price;
  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (atSeconds <= b.at_seconds) {
      const span = b.at_seconds - a.at_seconds;
      const fraction = span === 0 ? 1 : (atSeconds - a.at_seconds) / span;
      return a.price + fraction * (b.price - a.price);
    }
  }
  return sorted.at(-1)!.price;
}

function healthAnalysis(task: Extract<SpondeeTask, { schema: "spondee.health-factor.task.v1" }>) {
  const points = [...task.stress_path]
    .sort((a, b) => a.at_seconds - b.at_seconds)
    .map((point) => ({
      at_seconds: point.at_seconds,
      value:
        (task.position.collateral_usd * point.collateral_multiplier * task.position.liquidation_threshold) /
        (task.position.debt_usd * point.debt_multiplier),
    }));
  const floorCrossing = crossingTime(points, task.hf_floor, "lte");
  const warning = floorCrossing === null
    ? null
    : Math.max(0, floorCrossing - task.desired_warning_lead_seconds);
  return {
    floor_crossed: floorCrossing !== null,
    floor_crossing_seconds: floorCrossing,
    warning_issued_seconds: warning,
    useful_lead_seconds:
      floorCrossing === null || warning === null ? null : round(floorCrossing - warning, 2),
    minimum_hf: round(Math.min(...points.map((p) => p.value))),
  };
}

function gridAnalysis(task: Extract<SpondeeTask, { schema: "spondee.grid.task.v1" }>) {
  const path = [...task.declared_price_path].sort((a, b) => a.at_seconds - b.at_seconds);
  const step = (task.upper_price - task.lower_price) / (task.levels - 1);
  const gridLevels = Array.from({ length: task.levels }, (_, i) => task.lower_price + i * step);
  const crossed = new Set<number>();
  for (let i = 1; i < path.length; i += 1) {
    const lo = Math.min(path[i - 1].price, path[i].price);
    const hi = Math.max(path[i - 1].price, path[i].price);
    gridLevels.forEach((level, index) => {
      if (level >= lo && level <= hi) crossed.add(index);
    });
  }
  const below = crossingTime(
    path.map((p) => ({ at_seconds: p.at_seconds, value: p.price })),
    task.lower_price,
    "lte",
  );
  const above = crossingTime(
    path.map((p) => ({ at_seconds: p.at_seconds, value: p.price })),
    task.upper_price,
    "gte",
  );
  const breaks = [below, above].filter((x): x is number => x !== null);
  const rangeBreak = breaks.length ? Math.min(...breaks) : null;
  const estimatedExecutionBps = task.fee_bps + task.slippage_bps;
  return {
    projected_grid_levels_crossed: crossed.size,
    projected_range_break_seconds: rangeBreak,
    minimum_declared_price: round(Math.min(...path.map((p) => p.price))),
    maximum_declared_price: round(Math.max(...path.map((p) => p.price))),
    estimated_execution_cost_bps_per_fill: round(estimatedExecutionBps, 2),
  };
}

function rebalancingAnalysis(
  task: Extract<SpondeeTask, { schema: "spondee.rebalancing.task.v1" }>,
) {
  const path = [...task.declared_price_path].sort((a, b) => a.at_seconds - b.at_seconds);
  const values = path.map((p) => ({ at_seconds: p.at_seconds, value: p.price }));
  const below = crossingTime(values, task.position.lower_price, "lte");
  const above = crossingTime(values, task.position.upper_price, "gte");
  const exits = [below, above].filter((x): x is number => x !== null);
  const firstExit = exits.length ? Math.min(...exits) : null;
  const resetAt = firstExit === null ? null : firstExit + task.reset_latency_seconds;
  const resetPrice = resetAt === null ? null : priceAt(path, resetAt);
  const halfWidth = task.target_width_bps / 20_000;
  return {
    projected_out_of_range: firstExit !== null,
    first_out_of_range_seconds: firstExit,
    projected_reset_seconds: resetAt,
    projected_time_out_of_range_seconds: firstExit === null ? 0 : task.reset_latency_seconds,
    projected_reset_price: resetPrice === null ? null : round(resetPrice),
    projected_new_range:
      resetPrice === null
        ? null
        : {
            lower_price: round(resetPrice * (1 - halfWidth)),
            upper_price: round(resetPrice * (1 + halfWidth)),
          },
    estimated_reset_cost_usd: round(task.estimated_reset_cost_usd, 2),
  };
}

function horizonNetUsd(
  capitalUsd: number,
  aprPct: number,
  horizonDays: number,
  switchCostUsd: number,
): number {
  return capitalUsd * (aprPct / 100) * (horizonDays / 365) - switchCostUsd;
}

function yieldAnalysis(task: Extract<SpondeeTask, { schema: "spondee.yield.task.v1" }>) {
  const currentNet = horizonNetUsd(
    task.capital_usd,
    task.current.gross_apr_pct,
    task.horizon_days,
    0,
  );
  const eligible = task.candidates
    .filter((candidate) => candidate.risk_score <= task.max_risk_score)
    .map((candidate) => ({
      ...candidate,
      projected_net_horizon_usd: horizonNetUsd(
        task.capital_usd,
        candidate.gross_apr_pct,
        task.horizon_days,
        candidate.switch_cost_usd,
      ),
    }))
    .sort((a, b) => b.projected_net_horizon_usd - a.projected_net_horizon_usd);

  const best = eligible[0] ?? null;
  const chooseCandidate = best !== null && best.projected_net_horizon_usd > currentNet;
  return {
    selected_option_id: chooseCandidate ? best!.id : task.current.id,
    rotation_recommended: chooseCandidate,
    current_projected_net_horizon_usd: round(currentNet, 2),
    selected_projected_net_horizon_usd: round(
      chooseCandidate ? best!.projected_net_horizon_usd : currentNet,
      2,
    ),
    projected_net_horizon_uplift_usd: round(
      chooseCandidate ? best!.projected_net_horizon_usd - currentNet : 0,
      2,
    ),
    selected_risk_score: chooseCandidate ? best!.risk_score : task.current.risk_score,
    eligible_candidate_count: eligible.length,
  };
}

export function analyzeTask(task: SpondeeTask): Record<string, unknown> {
  switch (task.schema) {
    case "spondee.health-factor.task.v1":
      return healthAnalysis(task);
    case "spondee.grid.task.v1":
      return gridAnalysis(task);
    case "spondee.rebalancing.task.v1":
      return rebalancingAnalysis(task);
    case "spondee.yield.task.v1":
      return yieldAnalysis(task);
  }
}

function promiseNarrative(task: SpondeeTask, analysis: Record<string, unknown>): string {
  switch (task.schema) {
    case "spondee.health-factor.task.v1":
      return analysis.floor_crossed
        ? `Issue a deterministic warning before the declared Health Factor floor crossing in scenario ${task.scenario_id}.`
        : `Monitor scenario ${task.scenario_id}; no Health Factor floor crossing is projected on the declared path.`;
    case "spondee.grid.task.v1":
      return `Evaluate ${task.levels} declared grid levels and surface range-break/execution-cost conditions for scenario ${task.scenario_id}; no profit is promised.`;
    case "spondee.rebalancing.task.v1":
      return analysis.projected_out_of_range
        ? `Detect the declared LP range exit and produce a bounded reset plan after ${task.reset_latency_seconds}s latency in scenario ${task.scenario_id}.`
        : `Keep the declared LP range unchanged unless the scenario exits its bounds.`;
    case "spondee.yield.task.v1":
      return analysis.rotation_recommended
        ? `Select the highest projected net-horizon option within risk limit for scenario ${task.scenario_id}, after declared switch costs.`
        : `Retain the current yield option because no eligible declared candidate improves projected net-horizon return.`;
  }
}

function downside(task: SpondeeTask, analysis: Record<string, unknown>): Record<string, unknown> {
  switch (task.schema) {
    case "spondee.health-factor.task.v1":
      return {
        breach_projected: analysis.floor_crossed,
        minimum_projected_hf: analysis.minimum_hf,
        hf_floor: task.hf_floor,
      };
    case "spondee.grid.task.v1":
      return {
        range_break_projected: analysis.projected_range_break_seconds !== null,
        projected_range_break_seconds: analysis.projected_range_break_seconds,
        no_pnl_guarantee: true,
      };
    case "spondee.rebalancing.task.v1":
      return {
        out_of_range_projected: analysis.projected_out_of_range,
        projected_time_out_of_range_seconds: analysis.projected_time_out_of_range_seconds,
        estimated_reset_cost_usd: task.estimated_reset_cost_usd,
      };
    case "spondee.yield.task.v1":
      return {
        selected_risk_score: analysis.selected_risk_score,
        max_risk_score: task.max_risk_score,
        switch_costs_included: true,
        yield_not_guaranteed: true,
      };
  }
}

function timing(task: SpondeeTask, analysis: Record<string, unknown>): Record<string, unknown> {
  switch (task.schema) {
    case "spondee.health-factor.task.v1":
      return {
        predicted_floor_crossing_seconds: analysis.floor_crossing_seconds,
        expected_warning_issued_seconds: analysis.warning_issued_seconds,
        expected_warning_lead_seconds: analysis.useful_lead_seconds,
      };
    case "spondee.grid.task.v1":
      return { projected_range_break_seconds: analysis.projected_range_break_seconds };
    case "spondee.rebalancing.task.v1":
      return {
        first_out_of_range_seconds: analysis.first_out_of_range_seconds,
        projected_reset_seconds: analysis.projected_reset_seconds,
      };
    case "spondee.yield.task.v1":
      return { evaluation_horizon_days: task.horizon_days };
  }
}

function methodology(task: SpondeeTask): Record<string, unknown> {
  switch (task.schema) {
    case "spondee.health-factor.task.v1":
      return {
        model: "deterministic_declared_stress_path",
        interpolation: "linear_between_declared_points",
        calibration_history: "INSUFFICIENT_HISTORY",
      };
    case "spondee.grid.task.v1":
      return {
        model: "deterministic_declared_price_path_grid_crossings",
        pnl_model: "NONE",
        calibration_history: "INSUFFICIENT_HISTORY",
      };
    case "spondee.rebalancing.task.v1":
      return {
        model: "deterministic_declared_price_path_range_exit",
        reset_policy: "bounded_latency_recenter",
        calibration_history: "INSUFFICIENT_HISTORY",
      };
    case "spondee.yield.task.v1":
      return {
        model: "declared_apr_minus_amortized_switch_cost",
        risk_filter: "hard_max_risk_score",
        calibration_history: "INSUFFICIENT_HISTORY",
      };
  }
}

export function buildPromiseCard(
  task: SpondeeTask,
  agentId: string,
  agentVersion = "0.1.0",
  priceWei = 0n,
  now = new Date(),
): PromiseCard {
  const category = taskCategory(task);
  const analysis = analyzeTask(task);
  const promiseId = `sp_${digest({ task, agent_id: agentId, price_wei: String(priceWei) }).slice(0, 24)}`;
  return {
    schema: "spondee.promise-card.v1",
    category,
    promise_id: promiseId,
    scenario_id: task.scenario_id,
    agent_id: agentId,
    agent_version: agentVersion,
    evidence_class: "SIMULATION",
    expected_outcome: promiseNarrative(task, analysis),
    confidence: null,
    confidence_status: "UNSCORED_UNTIL_OBSERVED_CALIBRATION",
    expected_downside: downside(task, analysis),
    expected_cost: {
      currency: "raw_erc8183_wei",
      amount: String(priceWei),
      source: "fixed_zero_price_g3",
    },
    timing: timing(task, analysis),
    methodology: methodology(task),
    created_at: now.toISOString(),
    claim_guardrail:
      "Simulation only. This Promise Card is not observed performance evidence and does not guarantee profit, yield, execution quality, or liquidation prevention.",
  };
}

export function buildSimulationReceipt(
  task: SpondeeTask,
  promise: PromiseCard,
  now = new Date(),
): OutcomeReceipt {
  if (promise.scenario_id !== task.scenario_id || promise.category !== taskCategory(task)) {
    throw new Error("Promise Card does not match the task scenario/category.");
  }
  const actualOutcome = analyzeTask(task);
  return {
    schema: "spondee.outcome-receipt.v1",
    receipt_id: `sr_${digest({ promise_id: promise.promise_id, actual_outcome: actualOutcome }).slice(0, 24)}`,
    category: promise.category,
    promise_id: promise.promise_id,
    scenario_id: task.scenario_id,
    agent_id: promise.agent_id,
    evidence_class: "SIMULATION",
    actual_outcome: actualOutcome,
    actual_cost: { currency: "raw_erc8183_wei", amount: "0" },
    tx_hashes: [],
    created_at: now.toISOString(),
    calibration: {
      eligible_for_observed_agent_advantage: false,
      status: "NOT_OBSERVED_MARKET_EVIDENCE",
    },
    claim_guardrail:
      "This receipt proves deterministic Promise-to-Outcome plumbing for declared simulation inputs only. It is excluded from observed Agent Advantage.",
  };
}
