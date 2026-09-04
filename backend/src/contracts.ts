import { z } from "zod";

export const CategorySchema = z.enum([
  "Health Factor Monitoring",
  "Grid Trading",
  "Rebalancing",
  "Yield Optimisation",
]);
export type Category = z.infer<typeof CategorySchema>;

export const CATEGORY_SLUGS: Record<Category, string> = {
  "Health Factor Monitoring": "health-factor",
  "Grid Trading": "grid",
  Rebalancing: "rebalancing",
  "Yield Optimisation": "yield",
};

const TimedPriceSchema = z.object({
  at_seconds: z.number().int().nonnegative(),
  price: z.number().positive(),
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
  stress_path: z.array(
    z.object({
      at_seconds: z.number().int().nonnegative(),
      collateral_multiplier: z.number().positive(),
      debt_multiplier: z.number().positive().default(1),
    }),
  ).min(2),
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

// Grid/Rebalancing carry cross-field refinements, so Zod v3 cannot place them
// inside discriminatedUnion. A normal union preserves every schema/refinement.
export const TaskSchema = z.union([
  HealthFactorTaskSchema,
  GridTaskSchema,
  RebalancingTaskSchema,
  YieldTaskSchema,
]);
export type SpondeeTask = z.infer<typeof TaskSchema>;

export interface PromiseCard {
  schema: "spondee.promise-card.v1";
  category: Category;
  promise_id: string;
  scenario_id: string;
  agent_id: string;
  agent_version: string;
  evidence_class: "SIMULATION";
  expected_outcome: string;
  confidence: null;
  confidence_status: "UNSCORED_UNTIL_OBSERVED_CALIBRATION";
  expected_downside: Record<string, unknown>;
  expected_cost: {
    currency: "raw_erc8183_wei";
    amount: string;
    source: "fixed_zero_price_g3";
  };
  timing: Record<string, unknown>;
  methodology: Record<string, unknown>;
  created_at: string;
  claim_guardrail: string;
}

export interface OutcomeReceipt {
  schema: "spondee.outcome-receipt.v1";
  receipt_id: string;
  category: Category;
  promise_id: string;
  scenario_id: string;
  agent_id: string;
  evidence_class: "SIMULATION";
  actual_outcome: Record<string, unknown>;
  actual_cost: {
    currency: "raw_erc8183_wei";
    amount: string;
  };
  tx_hashes: string[];
  created_at: string;
  calibration: {
    eligible_for_observed_agent_advantage: false;
    status: "NOT_OBSERVED_MARKET_EVIDENCE";
  };
  claim_guardrail: string;
}

export type ActivationMode = "SIMULATION" | "LIVE_TESTNET";
export type ActivationStatus =
  | "PREPARED"
  | "SIMULATED"
  | "BLOCKED_LIVE_GATE"
  | "CHAIN_FUNDED"
  | "CHAIN_SUBMITTED"
  | "COMPLETED"
  | "FAILED";

export interface ActivationRecord {
  activation_id: string;
  agent_id: string;
  category: Category;
  promise_id: string;
  scenario_id: string;
  mode: ActivationMode;
  status: ActivationStatus;
  task: SpondeeTask;
  promise: PromiseCard;
  receipt_id: string | null;
  chain: {
    network: "bsc-testnet" | null;
    job_id: string | null;
    tx_hashes: string[];
    deliverable_url: string | null;
  };
  created_at: string;
  updated_at: string;
  failure_reason: string | null;
}

export type AgentReadiness =
  | "LIVE_TESTNET_VERIFIED"
  | "SIMULATION_READY_REFERENCE_AGENT_NOT_DEPLOYED"
  | "DISCOVERY_ONLY_EXTERNAL";

export interface AgentIdentity {
  source: "SPONDEE" | "8004SCAN" | "ERC8004";
  registry_agent_id: string | null;
  network: "bsc" | "bsc-testnet";
  provider_address: string | null;
  identity_url: string | null;
}

export interface ActivationProof {
  status: "VERIFIED_LIVE_TESTNET" | "UNVERIFIED_EXTERNAL";
  network: "bsc-testnet" | "bsc";
  job_id: string | null;
  evidence_ref: string | null;
}

export interface AgentRecord {
  agent_id: string;
  name: string;
  version: string;
  category: Category;
  description: string;
  readiness: AgentReadiness;
  activatable: boolean;
  identity: AgentIdentity;
  activation_proof: ActivationProof;
  capabilities: string[];
  promise_schema: "spondee.promise-card.v1";
  receipt_schema: "spondee.outcome-receipt.v1";
}

export const EvidenceRunInputSchema = z.object({
  run_id: z.string().min(1),
  category: CategorySchema,
  scenario_id: z.string().min(1),
  agent_id: z.string().min(1),
  version: z.string().min(1),
  evidence_class: z.enum(["OBSERVED", "SIMULATION"]),
  promise_timestamp: z.string().min(1),
  expected_outcome: z.unknown(),
  confidence: z.number().min(0).max(1).nullable(),
  expected_downside: z.unknown(),
  expected_cost: z.unknown(),
  warning_timestamp: z.string().nullable().optional(),
  action_timestamp: z.string().nullable().optional(),
  event_timestamp: z.string().nullable().optional(),
  tx_hashes: z.array(z.string()).default([]),
  actual_outcome: z.unknown(),
  actual_cost: z.unknown(),
  output_artifacts: z.array(z.string()).default([]),
  baseline_type: z.string().nullable().optional(),
  baseline_run_id: z.string().nullable().optional(),
  advantage_delta: z.unknown().nullable().optional(),
  calibration_error: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type EvidenceRun = z.infer<typeof EvidenceRunInputSchema>;

export interface AgentAdvantageReport {
  generated_at: string;
  observed_run_count: number;
  paired_run_count: number;
  excluded_simulation_count: number;
  pairs: Array<{
    run_id: string;
    baseline_run_id: string;
    category: Category;
    agent_id: string;
    advantage_delta: unknown;
    calibration_error: number | null;
  }>;
  status: "READY" | "INSUFFICIENT_OBSERVED_EVIDENCE";
}
