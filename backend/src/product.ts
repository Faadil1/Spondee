import { CATEGORY_SLUGS, type Category } from "./contracts.js";

export const SPONDEE_PRODUCT = {
  schema: "spondee.product-definition.v1",
  name: "Spondee",
  tagline: "Agents, measured by what they deliver.",
  concept: "Calibrated Outcome Marketplace + Intervention Advantage",
  hero_category: "Health Factor Monitoring" as Category,
  primary_path: [
    "LAND",
    "CATEGORY",
    "AGENT",
    "PROMISE_CARD",
    "BOUNDED_ACTIVATE",
    "OUTCOME_RECEIPT",
    "PROMISE_VS_ACTUAL",
    "AGENT_ADVANTAGE_WHEN_AVAILABLE",
  ] as const,
  category_order: [
    "Health Factor Monitoring",
    "Grid Trading",
    "Rebalancing",
    "Yield Optimisation",
  ] as Category[],
  truth_boundary: {
    simulation_may_be_presented_as_observed: false,
    observed_performance_may_be_reframed_as_profit_guarantee: false,
    mainnet_value_movement_is_required_for_observed_market_evidence: false,
    external_registry_identity_implies_spondee_activation: false,
  },
  frontend_contract_version: "spondee.frontend-bootstrap.v1",
} as const;

export const CATEGORY_PRESENTATION: Record<Category, {
  slug: string;
  short_label: string;
  promise_question: string;
  receipt_focus: string;
}> = {
  "Health Factor Monitoring": {
    slug: CATEGORY_SLUGS["Health Factor Monitoring"],
    short_label: "Health Factor",
    promise_question: "How early can this agent warn and what bounded intervention does it recommend?",
    receipt_focus: "warning lead time, response latency, health-factor outcome, cost",
  },
  "Grid Trading": {
    slug: CATEGORY_SLUGS["Grid Trading"],
    short_label: "Grid Trading",
    promise_question: "What bounded range/grid behavior does the agent expect for this market window?",
    receipt_focus: "same-window terminal equity, drawdown, execution friction, fills",
  },
  Rebalancing: {
    slug: CATEGORY_SLUGS.Rebalancing,
    short_label: "Rebalancing",
    promise_question: "When should the bounded position be reset and at what estimated cost?",
    receipt_focus: "range exit, reset plan, latency, estimated reset cost",
  },
  "Yield Optimisation": {
    slug: CATEGORY_SLUGS["Yield Optimisation"],
    short_label: "Yield Optimisation",
    promise_question: "Which eligible option best fits the declared risk and horizon constraints?",
    receipt_focus: "selected option, projected net uplift, risk score, switch decision",
  },
};

export const BACKEND_CAPABILITY_MATRIX = {
  schema: "spondee.backend-capability-matrix.v1",
  backend_code_completion: "COMPLETE_PENDING_FINAL_CI",
  marketplace_catalog: "IMPLEMENTED",
  dynamic_8004scan_discovery: "IMPLEMENTED_SERVER_SIDE_READ_ONLY",
  promise_preview: "IMPLEMENTED",
  bounded_activation_record: "IMPLEMENTED",
  protected_live_action_scope: "IMPLEMENTED_FAIL_CLOSED",
  durable_live_operation_idempotency: "IMPLEMENTED",
  simulation_receipt: "IMPLEMENTED",
  live_bsc_testnet_transport_four_categories: "VERIFIED",
  outcome_receipt_storage: "IMPLEMENTED",
  postgres_persistence: "IMPLEMENTED",
  immutable_evidence_ingestion: "IMPLEMENTED_PROTECTED_IDEMPOTENT",
  decision_replay: "IMPLEMENTED_READ_ONLY",
  deployment_readiness_contract: "IMPLEMENTED",
  agent_advantage_schema: "IMPLEMENTED",
  first_countable_observed_grid_pair: "VERIFIED_JOB_962",
  observed_pair_requirement: "PARTIAL_1_OF_3",
  health_factor_observed_event_tape: "PENDING_EVIDENCE_WORKSTREAM_NOT_BACKEND_CODE",
  public_judge_deployment: "PENDING_RUNTIME_DEPLOYMENT_NOT_BACKEND_CODE",
  winner_intelligence_ui_enhancements: "POST_V1_NON_BLOCKING",
} as const;

export const CLOSED_LIVE_JOBS = ["949", "954", "955", "957", "962"] as const;
