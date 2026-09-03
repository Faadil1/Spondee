import { createHash } from "node:crypto";
import { z } from "zod";

const StressPointSchema = z.object({
  at_seconds: z.number().int().nonnegative(),
  collateral_multiplier: z.number().positive(),
  debt_multiplier: z.number().positive().default(1),
});

export const HealthFactorTaskSchema = z.object({
  schema: z.literal("spondee.health-factor.task.v1"),
  scenario_id: z.string().min(1).max(128),
  evidence_class: z.literal("SIMULATION"),
  position: z.object({
    collateral_usd: z.number().positive(),
    debt_usd: z.number().positive(),
    liquidation_threshold: z.number().gt(0).lte(1),
  }),
  hf_floor: z.number().positive(),
  desired_warning_lead_seconds: z.number().int().nonnegative().default(300),
  stress_path: z.array(StressPointSchema).min(2),
});

export type HealthFactorTask = z.infer<typeof HealthFactorTaskSchema>;

export interface HealthFactorPromiseCard {
  schema: "spondee.promise-card.v1";
  category: "Health Factor Monitoring";
  promise_id: string;
  scenario_id: string;
  evidence_class: "SIMULATION";
  expected_outcome: string;
  confidence: null;
  confidence_status: "UNSCORED_UNTIL_OBSERVED_CALIBRATION";
  expected_downside: {
    breach_projected: boolean;
    minimum_projected_hf: number;
    hf_floor: number;
  };
  expected_cost: {
    currency: "raw_erc8183_wei";
    amount: string;
    source: "fixed_studio_list_price";
  };
  timing: {
    predicted_floor_crossing_seconds: number | null;
    expected_warning_issued_seconds: number | null;
    expected_warning_lead_seconds: number | null;
  };
  methodology: {
    model: "deterministic_declared_stress_path";
    interpolation: "linear_between_declared_points";
    calibration_history: "INSUFFICIENT_HISTORY";
  };
  claim_guardrail: string;
}

export interface HealthFactorOutcomeReceipt {
  schema: "spondee.outcome-receipt.v1";
  category: "Health Factor Monitoring";
  promise_id: string;
  scenario_id: string;
  evidence_class: "SIMULATION";
  outcome: {
    floor_crossed: boolean;
    floor_crossing_seconds: number | null;
    warning_issued_seconds: number | null;
    useful_lead_seconds: number | null;
    minimum_hf: number;
  };
  calibration: {
    eligible_for_observed_agent_advantage: false;
    status: "NOT_OBSERVED_MARKET_EVIDENCE";
  };
  claim_guardrail: string;
}

interface Analysis {
  floorCrossed: boolean;
  floorCrossingSeconds: number | null;
  warningIssuedSeconds: number | null;
  usefulLeadSeconds: number | null;
  minimumHf: number;
}

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

function hash(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function hfAt(task: HealthFactorTask, collateralMultiplier: number, debtMultiplier: number): number {
  const collateral = task.position.collateral_usd * collateralMultiplier;
  const debt = task.position.debt_usd * debtMultiplier;
  return (collateral * task.position.liquidation_threshold) / debt;
}

export function analyzeHealthFactorTask(task: HealthFactorTask): Analysis {
  const points = [...task.stress_path]
    .sort((a, b) => a.at_seconds - b.at_seconds)
    .map((point) => ({
      t: point.at_seconds,
      hf: hfAt(task, point.collateral_multiplier, point.debt_multiplier),
    }));

  let crossing: number | null = null;
  if (points[0].hf <= task.hf_floor) {
    crossing = points[0].t;
  } else {
    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      const current = points[i];
      if (previous.hf > task.hf_floor && current.hf <= task.hf_floor) {
        const delta = previous.hf - current.hf;
        const fraction = delta === 0 ? 1 : (previous.hf - task.hf_floor) / delta;
        crossing = previous.t + fraction * (current.t - previous.t);
        break;
      }
    }
  }

  const minimumHf = Math.min(...points.map((point) => point.hf));
  const warningIssued =
    crossing === null ? null : Math.max(0, crossing - task.desired_warning_lead_seconds);
  const usefulLead = crossing === null || warningIssued === null ? null : crossing - warningIssued;

  return {
    floorCrossed: crossing !== null,
    floorCrossingSeconds: crossing === null ? null : round(crossing, 2),
    warningIssuedSeconds: warningIssued === null ? null : round(warningIssued, 2),
    usefulLeadSeconds: usefulLead === null ? null : round(usefulLead, 2),
    minimumHf: round(minimumHf),
  };
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function parseHealthFactorTask(value: unknown): HealthFactorTask | null {
  const parsed = HealthFactorTaskSchema.safeParse(parseMaybeJson(value));
  return parsed.success ? parsed.data : null;
}

export function taskFromRequest(request: Record<string, unknown>): HealthFactorTask | null {
  return parseHealthFactorTask(request.task ?? request.task_description);
}

export function buildHealthFactorPromise(
  task: HealthFactorTask,
  priceWei: bigint,
): HealthFactorPromiseCard {
  const analysis = analyzeHealthFactorTask(task);
  const promiseId = `sp_${hash({ task, price_wei: String(priceWei) }).slice(0, 24)}`;
  const expectedOutcome = analysis.floorCrossed
    ? `Issue a warning ${analysis.usefulLeadSeconds ?? 0}s before the declared HF floor crossing in scenario ${task.scenario_id}.`
    : `No HF floor breach is projected within declared scenario ${task.scenario_id}; continue monitoring.`;

  return {
    schema: "spondee.promise-card.v1",
    category: "Health Factor Monitoring",
    promise_id: promiseId,
    scenario_id: task.scenario_id,
    evidence_class: "SIMULATION",
    expected_outcome: expectedOutcome,
    confidence: null,
    confidence_status: "UNSCORED_UNTIL_OBSERVED_CALIBRATION",
    expected_downside: {
      breach_projected: analysis.floorCrossed,
      minimum_projected_hf: analysis.minimumHf,
      hf_floor: task.hf_floor,
    },
    expected_cost: {
      currency: "raw_erc8183_wei",
      amount: String(priceWei),
      source: "fixed_studio_list_price",
    },
    timing: {
      predicted_floor_crossing_seconds: analysis.floorCrossingSeconds,
      expected_warning_issued_seconds: analysis.warningIssuedSeconds,
      expected_warning_lead_seconds: analysis.usefulLeadSeconds,
    },
    methodology: {
      model: "deterministic_declared_stress_path",
      interpolation: "linear_between_declared_points",
      calibration_history: "INSUFFICIENT_HISTORY",
    },
    claim_guardrail:
      "Simulation only. This Promise Card is not an observed performance claim and does not guarantee liquidation prevention.",
  };
}

export function previewHealthFactorFromEnvelope(
  data: Record<string, unknown>,
  priceWei: bigint,
): HealthFactorPromiseCard | null {
  const task = parseHealthFactorTask(data.task ?? data.task_description);
  return task === null ? null : buildHealthFactorPromise(task, priceWei);
}

export function enrichHealthFactorNegotiation(
  request: Record<string, unknown>,
  priceWei: bigint,
): { request: Record<string, unknown>; promise: HealthFactorPromiseCard | null } {
  const task = taskFromRequest(request);
  if (task === null) return { request, promise: null };

  const promise = buildHealthFactorPromise(task, priceWei);
  const existingTerms =
    request.terms !== null && typeof request.terms === "object" && !Array.isArray(request.terms)
      ? (request.terms as Record<string, unknown>)
      : {};

  return {
    request: {
      ...request,
      terms: {
        ...existingTerms,
        spondee_promise: promise,
      },
    },
    promise,
  };
}

function termsPromise(value: unknown): HealthFactorPromiseCard | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const terms = value as Record<string, unknown>;
  const candidate = terms.spondee_promise;
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const p = candidate as Record<string, unknown>;
  if (p.schema !== "spondee.promise-card.v1" || typeof p.promise_id !== "string") return null;
  return candidate as HealthFactorPromiseCard;
}

export function buildHealthFactorOutcomeFromWorkPrompt(
  prompt: string,
): HealthFactorOutcomeReceipt | null {
  const marker = "JOB CONTEXT:\n";
  const index = prompt.indexOf(marker);
  if (index < 0) return null;

  let context: unknown;
  try {
    context = JSON.parse(prompt.slice(index + marker.length).trim());
  } catch {
    return null;
  }
  if (context === null || typeof context !== "object" || Array.isArray(context)) return null;
  const job = context as Record<string, unknown>;
  const task = parseHealthFactorTask(job.task);
  const promise = termsPromise(job.terms);
  if (task === null || promise === null || promise.scenario_id !== task.scenario_id) return null;

  const analysis = analyzeHealthFactorTask(task);
  return {
    schema: "spondee.outcome-receipt.v1",
    category: "Health Factor Monitoring",
    promise_id: promise.promise_id,
    scenario_id: task.scenario_id,
    evidence_class: "SIMULATION",
    outcome: {
      floor_crossed: analysis.floorCrossed,
      floor_crossing_seconds: analysis.floorCrossingSeconds,
      warning_issued_seconds: analysis.warningIssuedSeconds,
      useful_lead_seconds: analysis.usefulLeadSeconds,
      minimum_hf: analysis.minimumHf,
    },
    calibration: {
      eligible_for_observed_agent_advantage: false,
      status: "NOT_OBSERVED_MARKET_EVIDENCE",
    },
    claim_guardrail:
      "This receipt proves deterministic Promise-to-Outcome plumbing for a declared simulation. It is not eligible evidence for observed Agent Advantage.",
  };
}
