import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceRun } from "./contracts.js";
import { buildAgentAdvantageReport, calibrationSummary } from "./evidence.js";

function run(overrides: Partial<EvidenceRun>): EvidenceRun {
  return {
    run_id: "run-default",
    category: "Health Factor Monitoring",
    scenario_id: "scenario-1",
    agent_id: "spondee-health-factor",
    version: "0.1.0",
    evidence_class: "OBSERVED",
    promise_timestamp: "2026-09-03T20:00:00Z",
    expected_outcome: { warning: true },
    confidence: null,
    expected_downside: {},
    expected_cost: { amount: "0" },
    tx_hashes: [],
    actual_outcome: {},
    actual_cost: { amount: "0" },
    output_artifacts: [],
    ...overrides,
  };
}

test("simulation runs are excluded from Agent Advantage", () => {
  const simulation = run({ run_id: "sim", evidence_class: "SIMULATION" });
  const baseline = run({ run_id: "baseline", baseline_type: "manual" });
  const observed = run({
    run_id: "agent",
    baseline_run_id: "baseline",
    advantage_delta: { seconds_saved: 30 },
  });
  const report = buildAgentAdvantageReport([simulation, baseline, observed]);
  assert.equal(report.excluded_simulation_count, 1);
  assert.equal(report.observed_run_count, 2);
  assert.equal(report.paired_run_count, 1);
  assert.equal(report.status, "INSUFFICIENT_OBSERVED_EVIDENCE");
});

test("TermiX-ready status requires at least three explicit observed pairs", () => {
  const runs: EvidenceRun[] = [];
  for (let i = 0; i < 3; i += 1) {
    runs.push(run({ run_id: `baseline-${i}`, scenario_id: `s-${i}`, baseline_type: "manual" }));
    runs.push(run({
      run_id: `agent-${i}`,
      scenario_id: `s-${i}`,
      baseline_run_id: `baseline-${i}`,
      advantage_delta: { measured_delta: i + 1 },
    }));
  }
  const report = buildAgentAdvantageReport(runs);
  assert.equal(report.paired_run_count, 3);
  assert.equal(report.status, "READY");
});

test("calibration remains unavailable without observed scored confidence", () => {
  const summary = calibrationSummary([
    run({ run_id: "observed-unscored", confidence: null, calibration_error: null }),
    run({ run_id: "simulation", evidence_class: "SIMULATION", confidence: 0.9, calibration_error: 0.1 }),
  ], "spondee-health-factor");
  assert.equal(summary.observed_run_count, 1);
  assert.equal(summary.scored_calibration_count, 0);
  assert.equal(summary.mean_calibration_error, null);
  assert.equal(summary.status, "INSUFFICIENT_OBSERVED_HISTORY");
});
