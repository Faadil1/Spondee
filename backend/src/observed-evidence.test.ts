import test from "node:test";
import assert from "node:assert/strict";
import {
  buildValidatedObservedAdvantageReport,
  sha256Evidence,
  validateObservedPairBundle,
} from "./observed-evidence.js";

const GUARDRAIL =
  "OBSERVED means the task inputs, execution measurements and attached outputs are preserved from an actual measured run or observed-data replay. It does not imply realized mainnet profit or guarantee future performance.";

function artifact(
  kind: "INPUT_SNAPSHOT" | "AGENT_OUTPUT" | "BASELINE_OUTPUT" | "TIMING_LOG" | "COST_LOG" | "TRANSACTION_TAPE" | "MARKET_DATA" | "EVENT_TAPE",
  id: string,
  sourceType: "BSC_TESTNET_RPC" | "PUBLIC_MARKET_DATA" | "PUBLIC_PROTOCOL_API" | "LOCAL_RUNTIME_MEASUREMENT" | "MANUAL_BASELINE_MEASUREMENT" = "LOCAL_RUNTIME_MEASUREMENT",
) {
  return {
    artifact_id: id,
    kind,
    uri: `file:///${id}.json`,
    sha256: sha256Evidence(id),
    captured_at: "2026-09-04T06:00:00.000Z",
    source_type: sourceType,
    source_locator: sourceType === "BSC_TESTNET_RPC" ? "bsc-testnet:block:129000000" : `local:${id}`,
  };
}

function run(params: {
  runId: string;
  category: "Grid Trading" | "Health Factor Monitoring" | "Yield Optimisation";
  scenarioId: string;
  agentId: string;
  baselineRunId?: string | null;
  advantageDelta?: unknown;
  evidenceClass?: "OBSERVED" | "SIMULATION";
}) {
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

function pair(
  id: string,
  category: "Grid Trading" | "Health Factor Monitoring" | "Yield Optimisation",
) {
  const scenarioId = `${id}-scenario`;
  const baselineId = `${id}-baseline`;
  const agentId = `${id}-agent`;
  const start = "2026-09-04T06:00:00.000Z";
  const end = "2026-09-04T06:10:00.000Z";
  return {
    schema: "spondee.agent-advantage-pair.v1",
    pair_id: id,
    frozen_at: "2026-09-04T05:58:00.000Z",
    category,
    scenario_id: scenarioId,
    observation_mode: "LIVE_TESTNET_TASK",
    observation_window: { start_at: start, end_at: end },
    initial_state_sha256: sha256Evidence(`${id}:initial`),
    input_snapshot_sha256: sha256Evidence(`${id}:input`),
    agent_run: run({
      runId: agentId,
      category,
      scenarioId,
      agentId: `spondee-${id}`,
      baselineRunId: baselineId,
      advantageDelta: { quality_delta: 1 },
    }),
    baseline_run: run({
      runId: baselineId,
      category,
      scenarioId,
      agentId: "without-agent",
    }),
    time_seconds: {
      name: "completion_time",
      unit: "seconds",
      agent_value: 3,
      baseline_value: 8,
      higher_is_better: false,
    },
    cost: {
      name: "task_cost",
      unit: "usd",
      agent_value: 0,
      baseline_value: 0,
      higher_is_better: false,
    },
    output_quality: {
      name: "objective_quality",
      unit: "score",
      agent_value: 1,
      baseline_value: 0,
      higher_is_better: true,
    },
    artifacts: [
      artifact("INPUT_SNAPSHOT", `${id}-input`, "BSC_TESTNET_RPC"),
      artifact("AGENT_OUTPUT", `${id}-agent-output"`.replace('"', "")),
      artifact("BASELINE_OUTPUT", `${id}-baseline-output`),
    ],
    trading_record:
      category === "Grid Trading"
        ? {
            window_start_at: start,
            window_end_at: end,
            wins: 1,
            losses: 0,
            flat: 0,
            max_drawdown_pct: 0.5,
            gross_return_pct: 0.2,
            net_return_pct: 0.18,
            risk_basis: "bounded BSC-testnet notional",
            execution_environment: "BSC_TESTNET",
          }
        : null,
    limitations: ["Testnet/task-window evidence only; not realized mainnet performance."],
    claim_guardrail: GUARDRAIL,
  };
}

test("valid observed Grid pair requires external provenance and trading record", () => {
  const parsed = validateObservedPairBundle(pair("grid-1", "Grid Trading"));
  assert.equal(parsed.category, "Grid Trading");
  assert.equal(parsed.agent_run.evidence_class, "OBSERVED");
  assert.equal(parsed.trading_record?.wins, 1);
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
  assert.throws(() => validateObservedPairBundle(candidate), /Grid Trading observed pair requires a real record/);
});

test("local-only artifacts cannot establish OBSERVED provenance", () => {
  const candidate = pair("yield-local", "Yield Optimisation");
  candidate.artifacts = [
    artifact("INPUT_SNAPSHOT", "local-input"),
    artifact("AGENT_OUTPUT", "local-agent"),
    artifact("BASELINE_OUTPUT", "local-baseline"),
  ];
  assert.throws(() => validateObservedPairBundle(candidate), /requires external observed provenance/);
});

test("report remains insufficient below three pairs", () => {
  const report = buildValidatedObservedAdvantageReport([
    pair("grid-a", "Grid Trading"),
    pair("hf-a", "Health Factor Monitoring"),
  ]);
  assert.equal(report.paired_run_count, 2);
  assert.equal(report.status, "INSUFFICIENT_OBSERVED_EVIDENCE");
});

test("three validated pairs including Grid make report READY", () => {
  const report = buildValidatedObservedAdvantageReport([
    pair("grid-ready", "Grid Trading"),
    pair("hf-ready", "Health Factor Monitoring"),
    pair("yield-ready", "Yield Optimisation"),
  ]);
  assert.equal(report.paired_run_count, 3);
  assert.equal(report.status, "READY");
});

test("three non-trading pairs do not satisfy the final report gate", () => {
  const report = buildValidatedObservedAdvantageReport([
    pair("hf-1", "Health Factor Monitoring"),
    pair("hf-2", "Health Factor Monitoring"),
    pair("yield-1", "Yield Optimisation"),
  ]);
  assert.equal(report.paired_run_count, 3);
  assert.equal(report.status, "INSUFFICIENT_OBSERVED_EVIDENCE");
});
