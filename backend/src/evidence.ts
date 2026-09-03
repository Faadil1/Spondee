import type {
  AgentAdvantageReport,
  EvidenceRun,
} from "./contracts.js";

export function buildAgentAdvantageReport(runs: EvidenceRun[]): AgentAdvantageReport {
  const observed = runs.filter((run) => run.evidence_class === "OBSERVED");
  const simulationCount = runs.length - observed.length;
  const byId = new Map(observed.map((run) => [run.run_id, run]));

  const pairs = observed.flatMap((run) => {
    if (!run.baseline_run_id || run.advantage_delta == null) return [];
    const baseline = byId.get(run.baseline_run_id);
    if (!baseline || baseline.evidence_class !== "OBSERVED") return [];
    return [{
      run_id: run.run_id,
      baseline_run_id: baseline.run_id,
      category: run.category,
      agent_id: run.agent_id,
      advantage_delta: run.advantage_delta,
      calibration_error: run.calibration_error ?? null,
    }];
  });

  return {
    generated_at: new Date().toISOString(),
    observed_run_count: observed.length,
    paired_run_count: pairs.length,
    excluded_simulation_count: simulationCount,
    pairs,
    status: pairs.length >= 3 ? "READY" : "INSUFFICIENT_OBSERVED_EVIDENCE",
  };
}

export function calibrationSummary(runs: EvidenceRun[], agentId: string) {
  const observed = runs.filter(
    (run) => run.evidence_class === "OBSERVED" && run.agent_id === agentId,
  );
  const scored = observed.filter(
    (run) => run.confidence !== null && run.calibration_error != null,
  );
  const meanCalibrationError = scored.length
    ? scored.reduce((sum, run) => sum + (run.calibration_error ?? 0), 0) / scored.length
    : null;

  return {
    agent_id: agentId,
    observed_run_count: observed.length,
    scored_calibration_count: scored.length,
    mean_calibration_error: meanCalibrationError,
    status: scored.length === 0 ? "INSUFFICIENT_OBSERVED_HISTORY" : "OBSERVED_HISTORY_AVAILABLE",
    claim_guardrail:
      "Simulation runs are excluded. A calibration statistic is exposed only when observed runs contain explicit confidence and calibration error values.",
  } as const;
}
