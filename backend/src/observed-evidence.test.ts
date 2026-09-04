import test from "node:test";
import assert from "node:assert/strict";
import {
  buildValidatedObservedAdvantageReport,
  isCountableObservedPair,
  sha256Evidence,
  validateObservedPairBundle,
} from "./observed-evidence.js";

const GUARDRAIL =
  "OBSERVED means the task inputs, execution measurements and attached outputs are preserved from an actual measured run or observed-data replay. It does not imply realized mainnet profit or guarantee future performance.";

function artifact(kind: any, id: string, sourceType: any = "LOCAL_RUNTIME_MEASUREMENT") {
  return {
    artifact_id: id,
    kind,
    uri: `file:///${id}.json`,
    sha256: sha256Evidence(id),
    captured_at: "2026-09-04T06:00:00.000Z",
    source_type: sourceType,
    source_locator: sourceType.includes("BSC_") ? `chain:${id}` : `local:${id}`,
  };
}

function run(params: any): any {
  return {
    run_id: params.runId,
    category: params.category,
    scenario_id: params.scenarioId,
    agent_id: params.agentId,
    version: "g5-v1",
    evidence_class: params.evidenceClass ?? "OBSERVED",
    promise_timestamp: "2026-09-04T05:59:00.000Z",
    expected_outcome: { target: "measured" },
    confidence: null,
    expected_downside: { bounded: true },
    expected_cost: { amount: 0 },
    tx_hashes: [],
    actual_outcome: { result: "measured" },
    actual_cost: { amount: 0 },
    output_artifacts: [params.runId],
    baseline_type: params.baselineRunId ? "WITHOUT_AGENT" : null,
    baseline_run_id: params.baselineRunId ?? null,
    advantage_delta: params.advantageDelta ?? null,
    calibration_error: null,
    notes: null,
  };
}

function pair(id: string, category: any, countable = true): any {
  const scenarioId = `${id}-scenario`;
  const baselineId = `${id}-baseline`;
  const agentId = `${id}-agent`;
  const start = "2026-09-04T06:00:00.000Z";
  const end = "2026-09-04T06:10:00.000Z";
  return {
    schema: "spondee.agent-advantage-pair.v1",
    pair_id: id,
    frozen_at: countable ? "2026-09-04T05:58:00.000Z" : "2026-09-04T06:11:00.000Z",
    category,
    scenario_id: scenarioId,
    observation_mode: countable ? "LIVE_PUBLIC_DATA_TASK" : "HISTORICAL_OBSERVED_DATA_REPLAY",
    observation_window: { start_at: start, end_at: end },
    initial_state_sha256: sha256Evidence(`${id}:initial`),
    input_snapshot_sha256: sha256Evidence(`${id}:input`),
    marketplace_hire: countable
      ? {
          mode: "LIVE_BSC_TESTNET_MARKETPLACE",
          agent_transport: "ERC8183_BSC_TESTNET",
          promise_before_observation: true,
          activation_reference: `bsc-testnet:job:${id}`,
          countable_for_final_report: true,
        }
      : {
          mode: "DRY_RUN_REFERENCE_AGENT",
          agent_transport: "LOCAL_REFERENCE_AGENT",
          promise_before_observation: false,
          activation_reference: null,
          countable_for_final_report: false,
        },
    agent_run: run({ runId: agentId, category, scenarioId, agentId: `spondee-${id}`, baselineRunId: baselineId, advantageDelta: { quality_delta: 1 } }),
    baseline_run: run({ runId: baselineId, category, scenarioId, agentId: "without-agent" }),
    time_seconds: { name: "completion_time", unit: "seconds", agent_value: 3, baseline_value: 8, higher_is_better: false },
    cost: { name: "task_cost", unit: "usd", agent_value: 0, baseline_value: 0, higher_is_better: false },
    output_quality: { name: "objective_quality", unit: "score", agent_value: 1, baseline_value: 0, higher_is_better: true },
    artifacts: [
      artifact("INPUT_SNAPSHOT", `${id}-input`, "BSC_MAINNET_RPC_READ_ONLY"),
      artifact("AGENT_OUTPUT", `${id}-agent-output`),
      artifact("BASELINE_OUTPUT", `${id}-baseline-output`),
      artifact("TIMING_LOG", `${id}-timing`),
      artifact("COST_LOG", `${id}-cost`),
      artifact("MARKET_DATA", `${id}-market`, "BSC_MAINNET_RPC_READ_ONLY"),
      ...(countable ? [artifact("TRANSACTION_TAPE", `${id}-tx`, "BSC_TESTNET_RPC")] : []),
    ],
    trading_record: category === "Grid Trading" ? {
      window_start_at: start,
      window_end_at: end,
      wins: 1,
      losses: 0,
      flat: 0,
      max_drawdown_pct: 0.5,
      gross_return_pct: 0.2,
      net_return_pct: 0.18,
      risk_basis: "bounded observed-data paper execution",
      execution_environment: countable ? "BSC_TESTNET" : "OBSERVED_MARKET_DATA_REPLAY",
    } : null,
    limitations: ["Testnet/task-window evidence only; not realized mainnet performance."],
    claim_guardrail: GUARDRAIL,
  };
}

test("valid countable Grid pair requires marketplace activation evidence", () => {
  const parsed = validateObservedPairBundle(pair("grid-1", "Grid Trading"));
  assert.equal(parsed.category, "Grid Trading");
  assert.equal(isCountableObservedPair(parsed), true);
});

test("historical dry-run can validate structurally but never counts", () => {
  const candidate = pair("grid-dry", "Grid Trading", false);
  assert.doesNotThrow(() => validateObservedPairBundle(candidate));
  assert.equal(isCountableObservedPair(candidate), false);
  const report = buildValidatedObservedAdvantageReport([candidate]);
  assert.equal(report.paired_run_count, 0);
  assert.equal(report.status, "INSUFFICIENT_OBSERVED_EVIDENCE");
});

test("SIMULATION cannot be relabeled into an observed pair", () => {
  const candidate = pair("grid-sim", "Grid Trading");
  candidate.agent_run.evidence_class = "SIMULATION";
  assert.throws(() => validateObservedPairBundle(candidate), /agent run must be OBSERVED/);
});

test("mismatched baseline scenario fails closed", () => {
  const candidate = pair("hf-mismatch", "Health Factor Monitoring");
  candidate.baseline_run.scenario_id = "different-scenario";
  assert.throws(() => validateObservedPairBundle(candidate), /run scenario must match frozen pair scenario/);
});

test("Grid pair without trading record fails closed", () => {
  const candidate = pair("grid-no-record", "Grid Trading");
  candidate.trading_record = null;
  assert.throws(() => validateObservedPairBundle(candidate), /requires a real record/);
});

test("local-only artifacts cannot establish OBSERVED provenance", () => {
  const candidate = pair("yield-local", "Yield Optimisation");
  candidate.artifacts = [
    artifact("INPUT_SNAPSHOT", "local-input"),
    artifact("AGENT_OUTPUT", "local-agent"),
    artifact("BASELINE_OUTPUT", "local-baseline"),
    artifact("TIMING_LOG", "local-timing"),
    artifact("COST_LOG", "local-cost"),
    artifact("TRANSACTION_TAPE", "local-tx"),
  ];
  assert.throws(() => validateObservedPairBundle(candidate), /requires external observed provenance/);
});

test("countable pair requires a transaction tape", () => {
  const candidate = pair("grid-no-tx", "Grid Trading");
  candidate.artifacts = candidate.artifacts.filter((a: any) => a.kind !== "TRANSACTION_TAPE");
  assert.throws(() => validateObservedPairBundle(candidate), /TRANSACTION_TAPE/);
});

test("report remains insufficient below three countable pairs", () => {
  const report = buildValidatedObservedAdvantageReport([
    pair("grid-a", "Grid Trading"),
    pair("hf-a", "Health Factor Monitoring"),
  ]);
  assert.equal(report.paired_run_count, 2);
  assert.equal(report.status, "INSUFFICIENT_OBSERVED_EVIDENCE");
});

test("three validated countable pairs including Grid make report READY", () => {
  const report = buildValidatedObservedAdvantageReport([
    pair("grid-ready", "Grid Trading"),
    pair("hf-ready", "Health Factor Monitoring"),
    pair("yield-ready", "Yield Optimisation"),
  ]);
  assert.equal(report.paired_run_count, 3);
  assert.equal(report.status, "READY");
});

test("three non-trading countable pairs do not satisfy the final report gate", () => {
  const report = buildValidatedObservedAdvantageReport([
    pair("hf-1", "Health Factor Monitoring"),
    pair("hf-2", "Health Factor Monitoring"),
    pair("yield-1", "Yield Optimisation"),
  ]);
  assert.equal(report.paired_run_count, 3);
  assert.equal(report.status, "INSUFFICIENT_OBSERVED_EVIDENCE");
});
