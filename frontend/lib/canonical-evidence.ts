export type CanonicalEvidencePair = {
  category: "Grid Trading" | "Health Factor Monitoring" | "Rebalancing";
  job_id: "962" | "971" | "973";
  pair_id: string;
  outcome: "NEGATIVE" | "TIMING_ADVANTAGE_WITH_LIMITATION" | "NEUTRAL";
  headline: string;
  detail: string;
  limitation: string;
  evidence_ref: string;
};

export type CanonicalEvidenceSummary = {
  schema: "spondee.canonical-preserved-evidence-summary.v1";
  source: "REPOSITORY_PRESERVED_VERIFIED_EVIDENCE";
  required_pairs: 3;
  countable_pairs: 3;
  status: "READY";
  trading_requirement_satisfied: true;
  runtime_store_separate: true;
  pairs: CanonicalEvidencePair[];
  claim_guardrail: string;
};

export const CANONICAL_EVIDENCE_SUMMARY: CanonicalEvidenceSummary = {
  schema: "spondee.canonical-preserved-evidence-summary.v1",
  source: "REPOSITORY_PRESERVED_VERIFIED_EVIDENCE",
  required_pairs: 3,
  countable_pairs: 3,
  status: "READY",
  trading_requirement_satisfied: true,
  runtime_store_separate: true,
  pairs: [
    {
      category: "Grid Trading",
      job_id: "962",
      pair_id: "g5-grid-forward-job-962",
      outcome: "NEGATIVE",
      headline: "Agent finished $2.50 below the same-window baseline",
      detail: "Agent terminal equity $9,996.660009 vs baseline $9,999.160009.",
      limitation: "Observed market inputs with paper accounting; this is not realized mainnet PnL.",
      evidence_ref: "evidence/g5-grid-forward-job-962-countable-pass/README.md",
    },
    {
      category: "Health Factor Monitoring",
      job_id: "971",
      pair_id: "g5-health-forward-job-971",
      outcome: "TIMING_ADVANTAGE_WITH_LIMITATION",
      headline: "95.829 s measured warning lead",
      detail: "Response latency 0 ms across six future observed rounds; no adverse event occurred in the bounded window.",
      limitation: "Measured warning timing does not prove liquidation prevention, safety, or repeatable lead time.",
      evidence_ref: "evidence/g5-health-forward-job-971-countable-pass/README.md",
    },
    {
      category: "Rebalancing",
      job_id: "973",
      pair_id: "g5-rebalancing-forward-job-973",
      outcome: "NEUTRAL",
      headline: "Agent and baseline finished equal on this window",
      detail: "Both terminal equities were $10,002.727008; both terminal deviations were 1.363132 bps.",
      limitation: "Neutral observed evidence remains visible; no realized mainnet PnL is claimed.",
      evidence_ref: "evidence/g5-rebalancing-forward-job-973-countable-pass/README.md",
    },
  ],
  claim_guardrail:
    "This summary reports repository-preserved, previously verified canonical evidence. It is separate from evidence currently loaded into a fresh runtime store and never promotes simulation data to observed evidence.",
};
