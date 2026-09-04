import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CategorySchema,
  EvidenceRunInputSchema,
  type AgentAdvantageReport,
  type EvidenceRun,
} from "./contracts.js";
import { buildAgentAdvantageReport } from "./evidence.js";

const SHA256_HEX = /^sha256:[0-9a-f]{64}$/i;

export const ObservedArtifactSchema = z.object({
  artifact_id: z.string().min(1).max(160),
  kind: z.enum([
    "INPUT_SNAPSHOT",
    "AGENT_OUTPUT",
    "BASELINE_OUTPUT",
    "TIMING_LOG",
    "COST_LOG",
    "TRANSACTION_TAPE",
    "MARKET_DATA",
    "EVENT_TAPE",
  ]),
  uri: z.string().min(1),
  sha256: z.string().regex(SHA256_HEX),
  captured_at: z.string().datetime(),
  source_type: z.enum([
    "BSC_TESTNET_RPC",
    "PUBLIC_MARKET_DATA",
    "PUBLIC_PROTOCOL_API",
    "LOCAL_RUNTIME_MEASUREMENT",
    "MANUAL_BASELINE_MEASUREMENT",
  ]),
  source_locator: z.string().min(1),
});

export const ObservationWindowSchema = z.object({
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
}).superRefine((window, ctx) => {
  if (Date.parse(window.end_at) <= Date.parse(window.start_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["end_at"],
      message: "observation window end_at must be after start_at",
    });
  }
});

export const TradingRecordSchema = z.object({
  window_start_at: z.string().datetime(),
  window_end_at: z.string().datetime(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  flat: z.number().int().nonnegative().default(0),
  max_drawdown_pct: z.number().nonnegative(),
  gross_return_pct: z.number().finite(),
  net_return_pct: z.number().finite(),
  risk_basis: z.string().min(1),
  execution_environment: z.enum([
    "BSC_TESTNET",
    "OBSERVED_MARKET_DATA_REPLAY",
  ]),
}).superRefine((record, ctx) => {
  if (Date.parse(record.window_end_at) <= Date.parse(record.window_start_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["window_end_at"],
      message: "trading record window must be positive",
    });
  }
  if (record.wins + record.losses + record.flat < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["wins"],
      message: "trading record must contain at least one evaluated outcome",
    });
  }
});

const MetricSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  agent_value: z.number().finite(),
  baseline_value: z.number().finite(),
  higher_is_better: z.boolean(),
});

export const ObservedPairBundleSchema = z.object({
  schema: z.literal("spondee.agent-advantage-pair.v1"),
  pair_id: z.string().min(1).max(160),
  frozen_at: z.string().datetime(),
  category: CategorySchema,
  scenario_id: z.string().min(1).max(160),
  observation_mode: z.enum([
    "LIVE_TESTNET_TASK",
    "LIVE_PUBLIC_DATA_TASK",
    "HISTORICAL_OBSERVED_DATA_REPLAY",
  ]),
  observation_window: ObservationWindowSchema,
  initial_state_sha256: z.string().regex(SHA256_HEX),
  input_snapshot_sha256: z.string().regex(SHA256_HEX),
  agent_run: EvidenceRunInputSchema,
  baseline_run: EvidenceRunInputSchema,
  time_seconds: MetricSchema,
  cost: MetricSchema,
  output_quality: MetricSchema,
  artifacts: z.array(ObservedArtifactSchema).min(3),
  trading_record: TradingRecordSchema.nullable().optional(),
  limitations: z.array(z.string().min(1)).min(1),
  claim_guardrail: z.literal(
    "OBSERVED means the task inputs, execution measurements and attached outputs are preserved from an actual measured run or observed-data replay. It does not imply realized mainnet profit or guarantee future performance.",
  ),
}).superRefine((bundle, ctx) => {
  const agent = bundle.agent_run;
  const baseline = bundle.baseline_run;

  const issue = (path: Array<string | number>, message: string) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  };

  if (agent.evidence_class !== "OBSERVED") {
    issue(["agent_run", "evidence_class"], "agent run must be OBSERVED");
  }
  if (baseline.evidence_class !== "OBSERVED") {
    issue(["baseline_run", "evidence_class"], "baseline run must be OBSERVED");
  }
  if (agent.run_id === baseline.run_id) {
    issue(["baseline_run", "run_id"], "agent and baseline run ids must differ");
  }
  for (const [name, run] of [["agent_run", agent], ["baseline_run", baseline]] as const) {
    if (run.category !== bundle.category) {
      issue([name, "category"], "run category must match bundle category");
    }
    if (run.scenario_id !== bundle.scenario_id) {
      issue([name, "scenario_id"], "run scenario must match frozen pair scenario");
    }
  }
  if (agent.baseline_run_id !== baseline.run_id) {
    issue(["agent_run", "baseline_run_id"], "agent run must reference this exact baseline run");
  }
  if (baseline.baseline_run_id != null) {
    issue(["baseline_run", "baseline_run_id"], "baseline run cannot itself reference another baseline");
  }
  if (agent.advantage_delta == null) {
    issue(["agent_run", "advantage_delta"], "agent run requires an explicit observed advantage_delta");
  }

  const kinds = new Set(bundle.artifacts.map((artifact) => artifact.kind));
  for (const required of ["INPUT_SNAPSHOT", "AGENT_OUTPUT", "BASELINE_OUTPUT"] as const) {
    if (!kinds.has(required)) {
      issue(["artifacts"], `missing required raw artifact kind ${required}`);
    }
  }

  const sourceTypes = new Set(bundle.artifacts.map((artifact) => artifact.source_type));
  if (
    !sourceTypes.has("BSC_TESTNET_RPC") &&
    !sourceTypes.has("PUBLIC_MARKET_DATA") &&
    !sourceTypes.has("PUBLIC_PROTOCOL_API")
  ) {
    issue(
      ["artifacts"],
      "OBSERVED pair requires external observed provenance from BSC testnet, public market data, or a public protocol API",
    );
  }

  if (bundle.category === "Grid Trading") {
    if (!bundle.trading_record) {
      issue(["trading_record"], "Grid Trading observed pair requires a real record with window, outcomes and risk");
    } else {
      if (
        bundle.trading_record.window_start_at !== bundle.observation_window.start_at ||
        bundle.trading_record.window_end_at !== bundle.observation_window.end_at
      ) {
        issue(["trading_record"], "trading record window must exactly match observation window");
      }
    }
  }
});

export type ObservedPairBundle = z.infer<typeof ObservedPairBundleSchema>;

export function sha256Evidence(value: string | Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function validateObservedPairBundle(value: unknown): ObservedPairBundle {
  return ObservedPairBundleSchema.parse(value);
}

export function buildValidatedObservedAdvantageReport(
  bundles: unknown[],
): AgentAdvantageReport {
  const validated = bundles.map(validateObservedPairBundle);
  const pairIds = new Set<string>();
  const runs: EvidenceRun[] = [];

  for (const bundle of validated) {
    if (pairIds.has(bundle.pair_id)) {
      throw new Error(`duplicate observed pair_id: ${bundle.pair_id}`);
    }
    pairIds.add(bundle.pair_id);
    runs.push(bundle.baseline_run, bundle.agent_run);
  }

  const report = buildAgentAdvantageReport(runs);
  const tradingPairs = validated.filter((bundle) => bundle.category === "Grid Trading").length;
  if (report.status === "READY" && tradingPairs < 1) {
    return { ...report, status: "INSUFFICIENT_OBSERVED_EVIDENCE" };
  }
  return report;
}
