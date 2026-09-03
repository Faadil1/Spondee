import type { SpondeeTask } from "./contracts.js";

export const DEMO_TASKS: readonly SpondeeTask[] = [
  {
    schema: "spondee.health-factor.task.v1",
    scenario_id: "backend-hf-001",
    evidence_class: "SIMULATION",
    position: {
      collateral_usd: 2000,
      debt_usd: 1000,
      liquidation_threshold: 0.8,
    },
    hf_floor: 1.2,
    desired_warning_lead_seconds: 120,
    stress_path: [
      { at_seconds: 0, collateral_multiplier: 1, debt_multiplier: 1 },
      { at_seconds: 300, collateral_multiplier: 0.9, debt_multiplier: 1 },
      { at_seconds: 600, collateral_multiplier: 0.7, debt_multiplier: 1 },
    ],
  },
  {
    schema: "spondee.grid.task.v1",
    scenario_id: "backend-grid-001",
    evidence_class: "SIMULATION",
    capital_usd: 5000,
    lower_price: 90,
    upper_price: 110,
    levels: 5,
    fee_bps: 10,
    slippage_bps: 5,
    declared_price_path: [
      { at_seconds: 0, price: 100 },
      { at_seconds: 120, price: 106 },
      { at_seconds: 240, price: 111 },
      { at_seconds: 360, price: 103 },
    ],
  },
  {
    schema: "spondee.rebalancing.task.v1",
    scenario_id: "backend-rebalance-001",
    evidence_class: "SIMULATION",
    position: {
      capital_usd: 10000,
      lower_price: 95,
      upper_price: 105,
    },
    target_width_bps: 1000,
    reset_latency_seconds: 45,
    estimated_reset_cost_usd: 2.5,
    declared_price_path: [
      { at_seconds: 0, price: 100 },
      { at_seconds: 180, price: 104 },
      { at_seconds: 300, price: 108 },
    ],
  },
  {
    schema: "spondee.yield.task.v1",
    scenario_id: "backend-yield-001",
    evidence_class: "SIMULATION",
    capital_usd: 10000,
    horizon_days: 30,
    max_risk_score: 60,
    current: {
      id: "current-pool",
      gross_apr_pct: 8,
      risk_score: 35,
      switch_cost_usd: 0,
    },
    candidates: [
      {
        id: "candidate-a",
        gross_apr_pct: 12,
        risk_score: 50,
        switch_cost_usd: 8,
      },
      {
        id: "candidate-too-risky",
        gross_apr_pct: 24,
        risk_score: 90,
        switch_cost_usd: 5,
      },
    ],
  },
];
