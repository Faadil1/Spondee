export type CategoryName =
  | "Health Factor Monitoring"
  | "Grid Trading"
  | "Rebalancing"
  | "Yield Optimisation";

export type AgentReadiness =
  | "LIVE_TESTNET_VERIFIED"
  | "SIMULATION_READY_REFERENCE_AGENT_NOT_DEPLOYED"
  | "DISCOVERY_ONLY_EXTERNAL";

export type AgentIdentity = {
  source: "SPONDEE" | "8004SCAN" | "ERC8004";
  registry_agent_id: string | null;
  network: "bsc" | "bsc-testnet";
  provider_address: string | null;
  identity_url: string | null;
};

export type ActivationProof = {
  status: "VERIFIED_LIVE_TESTNET" | "UNVERIFIED_EXTERNAL";
  network: "bsc" | "bsc-testnet";
  job_id: string | null;
  evidence_ref: string | null;
};

export type AgentRecord = {
  agent_id: string;
  name: string;
  version: string;
  category: CategoryName;
  description: string;
  readiness: AgentReadiness;
  activatable: boolean;
  identity: AgentIdentity;
  activation_proof: ActivationProof;
  capabilities: string[];
  promise_schema: "spondee.promise-card.v1";
  receipt_schema: "spondee.outcome-receipt.v1";
};

export type CategoryPresentation = {
  slug: string;
  short_label: string;
  promise_question: string;
  receipt_focus: string;
};

export type CategoryEntry = {
  category: CategoryName;
  presentation: CategoryPresentation;
  reference_agent: AgentRecord;
};

export type ProductDefinition = {
  schema: "spondee.product-definition.v1";
  name: string;
  tagline: string;
  concept: string;
  hero_category: CategoryName;
  primary_path: string[];
  category_order: CategoryName[];
  truth_boundary: Record<string, boolean>;
  frontend_contract_version: "spondee.frontend-bootstrap.v1";
};

export type AgentAdvantageReport = {
  generated_at: string;
  observed_run_count: number;
  paired_run_count: number;
  excluded_simulation_count: number;
  pairs: Array<{
    run_id: string;
    baseline_run_id: string;
    category: CategoryName;
    agent_id: string;
    advantage_delta: unknown;
    calibration_error: number | null;
  }>;
  status: "READY" | "INSUFFICIENT_OBSERVED_EVIDENCE";
};

export type CalibrationSummary = {
  agent_id: string;
  observed_run_count: number;
  scored_calibration_count: number;
  mean_calibration_error: number | null;
  status: "INSUFFICIENT_OBSERVED_HISTORY" | "OBSERVED_HISTORY_AVAILABLE";
  claim_guardrail: string;
};

export type TimedPrice = {
  at_seconds: number;
  price: number;
};

export type HealthFactorTask = {
  schema: "spondee.health-factor.task.v1";
  scenario_id: string;
  evidence_class: "SIMULATION";
  position: {
    collateral_usd: number;
    debt_usd: number;
    liquidation_threshold: number;
  };
  hf_floor: number;
  desired_warning_lead_seconds: number;
  stress_path: Array<{
    at_seconds: number;
    collateral_multiplier: number;
    debt_multiplier: number;
  }>;
};

export type GridTask = {
  schema: "spondee.grid.task.v1";
  scenario_id: string;
  evidence_class: "SIMULATION";
  capital_usd: number;
  lower_price: number;
  upper_price: number;
  levels: number;
  fee_bps: number;
  slippage_bps: number;
  declared_price_path: TimedPrice[];
};

export type RebalancingTask = {
  schema: "spondee.rebalancing.task.v1";
  scenario_id: string;
  evidence_class: "SIMULATION";
  position: {
    capital_usd: number;
    lower_price: number;
    upper_price: number;
  };
  target_width_bps: number;
  reset_latency_seconds: number;
  estimated_reset_cost_usd: number;
  declared_price_path: TimedPrice[];
};

export type YieldOption = {
  id: string;
  gross_apr_pct: number;
  risk_score: number;
  switch_cost_usd: number;
};

export type YieldTask = {
  schema: "spondee.yield.task.v1";
  scenario_id: string;
  evidence_class: "SIMULATION";
  capital_usd: number;
  horizon_days: number;
  max_risk_score: number;
  current: YieldOption;
  candidates: YieldOption[];
};

export type SpondeeTask = HealthFactorTask | GridTask | RebalancingTask | YieldTask;

export type PromiseCard = {
  schema: "spondee.promise-card.v1";
  category: CategoryName;
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
};

export type OutcomeReceipt = {
  schema: "spondee.outcome-receipt.v1";
  receipt_id: string;
  category: CategoryName;
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
};

export type ActivationMode = "SIMULATION" | "LIVE_TESTNET";

export type ActivationStatus =
  | "PREPARED"
  | "SIMULATED"
  | "BLOCKED_LIVE_GATE"
  | "CHAIN_FUNDED"
  | "CHAIN_SUBMITTED"
  | "COMPLETED"
  | "FAILED";

export type ActivationRecord = {
  activation_id: string;
  agent_id: string;
  category: CategoryName;
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
};

export type BootstrapResponse = {
  schema: "spondee.frontend-bootstrap.v1";
  product: ProductDefinition;
  backend_capabilities: Record<string, string>;
  categories: CategoryEntry[];
  agents: AgentRecord[];
  demo_tasks: SpondeeTask[];
  runtime: {
    live_testnet_write_ready: boolean;
    public_readiness_endpoint: string;
    backend_deployment_readiness_endpoint: string;
  };
  evidence: {
    agent_advantage_report: AgentAdvantageReport;
    calibration_by_agent: Record<string, CalibrationSummary>;
    countability_rule: string;
  };
  endpoints: Record<string, string>;
};

export type BootstrapResult =
  | { status: "success"; data: BootstrapResponse; backendBaseUrl: string }
  | { status: "unavailable"; message: string; backendBaseUrl: string }
  | { status: "malformed"; message: string; backendBaseUrl: string; received: unknown };

export type PromisePreviewResult =
  | { status: "success"; promise: PromiseCard }
  | { status: "validation_error"; message: string; details?: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type ActivationCreateResult =
  | { status: "success"; activation: ActivationRecord }
  | { status: "validation_error"; message: string; details?: unknown }
  | { status: "not_found"; message: string }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type ActivationFetchResult =
  | { status: "success"; activation: ActivationRecord }
  | { status: "not_found"; message: string }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type ActivationListResult =
  | { status: "success"; activations: ActivationRecord[] }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type ReceiptFetchResult =
  | { status: "success"; receipt: OutcomeReceipt }
  | { status: "not_found"; message: string }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type DecisionReplay = {
  schema: "spondee.decision-replay.v1";
  replay_mode: "READ_ONLY_RECONSTRUCTION";
  activation_id: string;
  category: CategoryName;
  agent_id: string;
  scenario_id: string;
  promise_id: string;
  status: ActivationStatus;
  truth: {
    promise_evidence_class: "SIMULATION";
    receipt_evidence_class: "SIMULATION" | null;
    observed_agent_advantage_eligible: false | null;
    chain_transport_observed: boolean;
    reexecution_performed: false;
  };
  inputs: SpondeeTask;
  promise: PromiseCard;
  authority: {
    mode: ActivationMode;
    network: "bsc-testnet" | null;
    job_id: string | null;
    transaction_hashes: string[];
    deliverable_url: string | null;
  };
  outcome: OutcomeReceipt | null;
  timeline: Array<{
    type:
      | "PROMISE_PREPARED"
      | "ACTIVATION_CREATED"
      | "CHAIN_TRANSACTION"
      | "OUTCOME_RECEIPT"
      | "ACTIVATION_UPDATED"
      | "FAILURE";
    at: string | null;
    label: string;
    reference: string | null;
  }>;
  claim_guardrail: string;
};

export type DecisionReplayFetchResult =
  | { status: "success"; replay: DecisionReplay }
  | { status: "not_found"; message: string }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type EvidenceRun = {
  run_id: string;
  category: CategoryName;
  scenario_id: string;
  agent_id: string;
  version: string;
  evidence_class: "OBSERVED" | "SIMULATION";
  promise_timestamp: string;
  expected_outcome: unknown;
  confidence: number | null;
  expected_downside: unknown;
  expected_cost: unknown;
  warning_timestamp?: string | null;
  action_timestamp?: string | null;
  event_timestamp?: string | null;
  tx_hashes: string[];
  actual_outcome: unknown;
  actual_cost: unknown;
  output_artifacts: string[];
  baseline_type?: string | null;
  baseline_run_id?: string | null;
  advantage_delta?: unknown | null;
  calibration_error?: number | null;
  notes?: string | null;
};

export type EvidenceListResult =
  | { status: "success"; evidence: EvidenceRun[] }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type EvidenceRunFetchResult =
  | { status: "success"; evidence: EvidenceRun }
  | { status: "not_found"; message: string }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type AgentAdvantageFetchResult =
  | { status: "success"; report: AgentAdvantageReport }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };

export type CalibrationFetchResult =
  | { status: "success"; calibration: CalibrationSummary }
  | { status: "not_found"; message: string }
  | { status: "malformed"; message: string; received: unknown }
  | { status: "server_error"; message: string; details?: unknown }
  | { status: "unavailable"; message: string };
