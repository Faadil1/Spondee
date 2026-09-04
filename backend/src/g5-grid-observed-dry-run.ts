import { performance } from "node:perf_hooks";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicClient, getAddress, http } from "viem";
import {
  buildValidatedObservedAdvantageReport,
  sha256Evidence,
  validateObservedPairBundle,
} from "./observed-evidence.js";

const RPC = process.env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org";
const FEED = getAddress("0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE");
const OUTPUT_DIR = resolve(process.env.SPONDEE_G5_OUTPUT_DIR?.trim() || ".g5-grid-dry-run");
const CAPITAL_USD = 10_000;
const LEVELS = 9;
const HALF_WIDTH_PCT = 0.15;
const FEE_BPS = 10;
const SLIPPAGE_BPS = 5;
const ROUND_TARGET = 25;

const abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    type: "function",
    name: "getRoundData",
    stateMutability: "view",
    inputs: [{ name: "_roundId", type: "uint80" }],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

type Round = {
  round_id: string;
  price_usd: number;
  updated_at: string;
};

type StrategyResult = {
  strategy: string;
  initial_equity_usd: number;
  terminal_equity_usd: number;
  gross_return_pct: number;
  net_return_pct: number;
  max_drawdown_pct: number;
  estimated_execution_friction_usd: number;
  fill_count: number;
  wins: number;
  losses: number;
  flat: number;
  final_cash_usd: number;
  final_bnb: number;
  parameters: Record<string, unknown>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function roundNumber(value: number, digits = 8): number {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function save(name: string, value: unknown): Promise<{ content: string; path: string; sha256: string }> {
  const content = json(value);
  const path = resolve(OUTPUT_DIR, name);
  await writeFile(path, content, "utf8");
  return { content, path, sha256: sha256Evidence(content) };
}

function crossedLevel(a: number, b: number, level: number): "UP" | "DOWN" | null {
  if (a < level && b >= level) return "UP";
  if (a > level && b <= level) return "DOWN";
  return null;
}

function maxDrawdown(equity: number[]): number {
  let peak = equity[0] ?? 0;
  let max = 0;
  for (const value of equity) {
    peak = Math.max(peak, value);
    if (peak > 0) max = Math.max(max, ((peak - value) / peak) * 100);
  }
  return roundNumber(max, 6);
}

function evaluateGrid(rounds: Round[]): StrategyResult {
  const first = rounds[0]!.price_usd;
  const lower = first * (1 - HALF_WIDTH_PCT / 100);
  const upper = first * (1 + HALF_WIDTH_PCT / 100);
  const step = (upper - lower) / (LEVELS - 1);
  const levels = Array.from({ length: LEVELS }, (_, i) => lower + i * step);
  const perFillQuote = CAPITAL_USD / (LEVELS * 4);
  const frictionRate = (FEE_BPS + SLIPPAGE_BPS) / 10_000;

  let cash = CAPITAL_USD / 2;
  let bnb = (CAPITAL_USD / 2) / first;
  let friction = 0;
  let fills = 0;
  const equity: number[] = [cash + bnb * first];
  const intervalPnl: number[] = [];

  for (let i = 1; i < rounds.length; i += 1) {
    const prev = rounds[i - 1]!.price_usd;
    const next = rounds[i]!.price_usd;
    const crossed = levels
      .map((level) => ({ level, direction: crossedLevel(prev, next, level) }))
      .filter((x): x is { level: number; direction: "UP" | "DOWN" } => x.direction !== null)
      .sort((a, b) => next >= prev ? a.level - b.level : b.level - a.level);

    for (const event of crossed) {
      if (event.direction === "DOWN") {
        const quote = Math.min(perFillQuote, cash / (1 + frictionRate));
        if (quote <= 0) continue;
        const cost = quote * frictionRate;
        cash -= quote + cost;
        bnb += quote / event.level;
        friction += cost;
        fills += 1;
      } else {
        const units = Math.min(perFillQuote / event.level, bnb);
        if (units <= 0) continue;
        const gross = units * event.level;
        const cost = gross * frictionRate;
        cash += gross - cost;
        bnb -= units;
        friction += cost;
        fills += 1;
      }
    }

    const current = cash + bnb * next;
    const prior = equity[equity.length - 1]!;
    intervalPnl.push(current - prior);
    equity.push(current);
  }

  const terminal = equity[equity.length - 1]!;
  const netReturn = ((terminal / CAPITAL_USD) - 1) * 100;
  const grossReturn = netReturn + (friction / CAPITAL_USD) * 100;
  const epsilon = 1e-8;
  const wins = intervalPnl.filter((v) => v > epsilon).length;
  const losses = intervalPnl.filter((v) => v < -epsilon).length;
  const flat = intervalPnl.length - wins - losses;

  return {
    strategy: "bounded_symmetric_paper_grid_on_observed_chainlink_path",
    initial_equity_usd: CAPITAL_USD,
    terminal_equity_usd: roundNumber(terminal, 6),
    gross_return_pct: roundNumber(grossReturn, 6),
    net_return_pct: roundNumber(netReturn, 6),
    max_drawdown_pct: maxDrawdown(equity),
    estimated_execution_friction_usd: roundNumber(friction, 6),
    fill_count: fills,
    wins,
    losses,
    flat: Math.max(flat, intervalPnl.length === 0 ? 1 : 0),
    final_cash_usd: roundNumber(cash, 6),
    final_bnb: roundNumber(bnb, 10),
    parameters: {
      capital_usd: CAPITAL_USD,
      starting_allocation: "50% USD / 50% BNB",
      levels: LEVELS,
      lower_price: roundNumber(lower, 8),
      upper_price: roundNumber(upper, 8),
      half_width_pct: HALF_WIDTH_PCT,
      fee_bps: FEE_BPS,
      slippage_bps: SLIPPAGE_BPS,
      per_fill_quote_usd: roundNumber(perFillQuote, 6),
      no_lookahead_configuration: true,
    },
  };
}

function evaluateBaseline(rounds: Round[]): StrategyResult {
  const first = rounds[0]!.price_usd;
  const cash = CAPITAL_USD / 2;
  const bnb = (CAPITAL_USD / 2) / first;
  const equity = rounds.map((r) => cash + bnb * r.price_usd);
  const terminal = equity[equity.length - 1]!;
  const intervalPnl = equity.slice(1).map((value, i) => value - equity[i]!);
  const epsilon = 1e-8;
  const wins = intervalPnl.filter((v) => v > epsilon).length;
  const losses = intervalPnl.filter((v) => v < -epsilon).length;
  const flat = intervalPnl.length - wins - losses;

  return {
    strategy: "without_agent_static_50_50_buy_and_hold",
    initial_equity_usd: CAPITAL_USD,
    terminal_equity_usd: roundNumber(terminal, 6),
    gross_return_pct: roundNumber(((terminal / CAPITAL_USD) - 1) * 100, 6),
    net_return_pct: roundNumber(((terminal / CAPITAL_USD) - 1) * 100, 6),
    max_drawdown_pct: maxDrawdown(equity),
    estimated_execution_friction_usd: 0,
    fill_count: 0,
    wins,
    losses,
    flat: Math.max(flat, intervalPnl.length === 0 ? 1 : 0),
    final_cash_usd: cash,
    final_bnb: roundNumber(bnb, 10),
    parameters: {
      capital_usd: CAPITAL_USD,
      starting_allocation: "50% USD / 50% BNB",
      rebalance_or_grid_actions: 0,
    },
  };
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const client = createPublicClient({ transport: http(RPC, { timeout: 15_000 }) });
  const chainId = await client.getChainId();
  assert(chainId === 56, `expected BSC mainnet chain 56, received ${chainId}`);

  const [blockNumber, decimals, description, latest] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({ address: FEED, abi, functionName: "decimals" }),
    client.readContract({ address: FEED, abi, functionName: "description" }),
    client.readContract({ address: FEED, abi, functionName: "latestRoundData" }),
  ]);
  const latestRoundId = latest[0];
  assert(String(description).toUpperCase().includes("BNB"), `unexpected feed description: ${description}`);

  const rounds: Round[] = [];
  for (let offset = BigInt(ROUND_TARGET - 1); offset >= 0n; offset -= 1n) {
    try {
      const r = await client.readContract({ address: FEED, abi, functionName: "getRoundData", args: [latestRoundId - offset] });
      const [roundId, answer, , updatedAt] = r;
      if (answer > 0n && updatedAt > 0n) {
        rounds.push({
          round_id: roundId.toString(),
          price_usd: Number(answer) / 10 ** Number(decimals),
          updated_at: new Date(Number(updatedAt) * 1000).toISOString(),
        });
      }
    } catch {
      // Phase-boundary gaps are allowed; the dry run requires a sufficiently long readable tail.
    }
    if (offset === 0n) break;
  }

  rounds.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at));
  assert(rounds.length >= 10, `need at least 10 immutable BNB/USD rounds, received ${rounds.length}`);
  const startAt = rounds[0]!.updated_at;
  const endAt = rounds[rounds.length - 1]!.updated_at;
  assert(Date.parse(endAt) > Date.parse(startAt), "observed Chainlink window is not positive");

  const frozenAt = new Date().toISOString();
  const scenarioId = `g5-grid-dry-run-${rounds[0]!.round_id}-${rounds.at(-1)!.round_id}`;
  const pairId = `g5-grid-dry-${rounds.at(-1)!.round_id}`;
  const initialState = {
    capital_usd: CAPITAL_USD,
    starting_allocation: "50% USD / 50% BNB",
    first_price_usd: rounds[0]!.price_usd,
    grid_levels: LEVELS,
    half_width_pct: HALF_WIDTH_PCT,
    fee_bps: FEE_BPS,
    slippage_bps: SLIPPAGE_BPS,
    configuration_basis: "first observed round only",
  };
  const inputSnapshot = {
    schema: "spondee.g5-grid-input-snapshot.v1",
    scenario_id: scenarioId,
    source: {
      network: "bsc-mainnet",
      chain_id: 56,
      rpc: RPC,
      block_number: blockNumber.toString(),
      feed_address: FEED,
      feed_description: String(description),
      decimals: Number(decimals),
    },
    observation_window: { start_at: startAt, end_at: endAt },
    initial_state: initialState,
    rounds,
    claim_guardrail: "Historical observed-data replay only; no mainnet execution or realized PnL is claimed.",
  };

  const inputArtifact = await save("input-snapshot.json", inputSnapshot);
  const marketArtifact = await save("market-data.json", { source: inputSnapshot.source, rounds });

  const agentStart = performance.now();
  const agentOutput = evaluateGrid(rounds);
  const agentSeconds = (performance.now() - agentStart) / 1000;
  const baselineStart = performance.now();
  const baselineOutput = evaluateBaseline(rounds);
  const baselineSeconds = (performance.now() - baselineStart) / 1000;

  const agentArtifact = await save("agent-output.json", agentOutput);
  const baselineArtifact = await save("baseline-output.json", baselineOutput);
  const timingArtifact = await save("timing-log.json", {
    unit: "seconds",
    agent_value: agentSeconds,
    baseline_value: baselineSeconds,
    measurement: "node_performance_now_local_runtime",
  });
  const costArtifact = await save("cost-log.json", {
    unit: "usd",
    agent_value: agentOutput.estimated_execution_friction_usd,
    baseline_value: baselineOutput.estimated_execution_friction_usd,
    basis: "paper execution friction from declared fee_bps + slippage_bps; no capital moved",
  });

  const artifact = (kind: string, id: string, saved: { path: string; sha256: string }, sourceType: string, locator: string) => ({
    artifact_id: id,
    kind,
    uri: `file://${saved.path.replaceAll("\\", "/")}`,
    sha256: saved.sha256,
    captured_at: frozenAt,
    source_type: sourceType,
    source_locator: locator,
  });

  const baselineRunId = `${pairId}-baseline`;
  const agentRunId = `${pairId}-agent`;
  const artifacts = [
    artifact("INPUT_SNAPSHOT", `${pairId}-input`, inputArtifact, "BSC_MAINNET_RPC_READ_ONLY", `bsc-mainnet:chainlink:${FEED}:block:${blockNumber}`),
    artifact("MARKET_DATA", `${pairId}-market`, marketArtifact, "BSC_MAINNET_RPC_READ_ONLY", `bsc-mainnet:chainlink:${FEED}:rounds:${rounds[0]!.round_id}-${rounds.at(-1)!.round_id}`),
    artifact("AGENT_OUTPUT", `${pairId}-agent-output`, agentArtifact, "LOCAL_RUNTIME_MEASUREMENT", "local:g5-grid-paper-agent"),
    artifact("BASELINE_OUTPUT", `${pairId}-baseline-output`, baselineArtifact, "LOCAL_RUNTIME_MEASUREMENT", "local:g5-grid-without-agent-baseline"),
    artifact("TIMING_LOG", `${pairId}-timing`, timingArtifact, "LOCAL_RUNTIME_MEASUREMENT", "local:node-performance-now"),
    artifact("COST_LOG", `${pairId}-cost`, costArtifact, "LOCAL_RUNTIME_MEASUREMENT", "local:paper-friction-ledger"),
  ];

  const bundle = {
    schema: "spondee.agent-advantage-pair.v1",
    pair_id: pairId,
    frozen_at: frozenAt,
    category: "Grid Trading",
    scenario_id: scenarioId,
    observation_mode: "HISTORICAL_OBSERVED_DATA_REPLAY",
    observation_window: { start_at: startAt, end_at: endAt },
    initial_state_sha256: sha256Evidence(json(initialState)),
    input_snapshot_sha256: inputArtifact.sha256,
    marketplace_hire: {
      mode: "DRY_RUN_REFERENCE_AGENT",
      agent_transport: "LOCAL_REFERENCE_AGENT",
      promise_before_observation: false,
      activation_reference: null,
      countable_for_final_report: false,
    },
    agent_run: {
      run_id: agentRunId,
      category: "Grid Trading",
      scenario_id: scenarioId,
      agent_id: "spondee-grid-reference-v1",
      version: "g5-grid-dry-run-v1",
      evidence_class: "OBSERVED",
      promise_timestamp: frozenAt,
      expected_outcome: { method: "bounded symmetric grid paper strategy", no_profit_promise: true },
      confidence: null,
      expected_downside: { observed_data_replay: true, realized_mainnet_pnl: false },
      expected_cost: { basis: "paper friction only", amount_usd: agentOutput.estimated_execution_friction_usd },
      tx_hashes: [],
      actual_outcome: agentOutput,
      actual_cost: { amount_usd: agentOutput.estimated_execution_friction_usd },
      output_artifacts: [`${pairId}-agent-output`, `${pairId}-timing`, `${pairId}-cost`],
      baseline_type: "WITHOUT_AGENT_STATIC_50_50_BUY_AND_HOLD",
      baseline_run_id: baselineRunId,
      advantage_delta: {
        terminal_equity_usd: roundNumber(agentOutput.terminal_equity_usd - baselineOutput.terminal_equity_usd, 6),
        net_return_pct: roundNumber(agentOutput.net_return_pct - baselineOutput.net_return_pct, 6),
        max_drawdown_pct: roundNumber(agentOutput.max_drawdown_pct - baselineOutput.max_drawdown_pct, 6),
      },
      calibration_error: null,
      notes: "Dry-run replay; structurally observed but not countable until a marketplace-hired forward-window execution exists.",
    },
    baseline_run: {
      run_id: baselineRunId,
      category: "Grid Trading",
      scenario_id: scenarioId,
      agent_id: "without-agent-static-50-50",
      version: "g5-grid-baseline-v1",
      evidence_class: "OBSERVED",
      promise_timestamp: frozenAt,
      expected_outcome: { method: "static 50/50 hold" },
      confidence: null,
      expected_downside: { market_exposure: true },
      expected_cost: { amount_usd: 0 },
      tx_hashes: [],
      actual_outcome: baselineOutput,
      actual_cost: { amount_usd: 0 },
      output_artifacts: [`${pairId}-baseline-output`, `${pairId}-timing`, `${pairId}-cost`],
      baseline_type: null,
      baseline_run_id: null,
      advantage_delta: null,
      calibration_error: null,
      notes: "Without-agent baseline on the exact same frozen observed Chainlink path.",
    },
    time_seconds: {
      name: "local_computation_time",
      unit: "seconds",
      agent_value: agentSeconds,
      baseline_value: baselineSeconds,
      higher_is_better: false,
    },
    cost: {
      name: "estimated_execution_friction",
      unit: "usd",
      agent_value: agentOutput.estimated_execution_friction_usd,
      baseline_value: 0,
      higher_is_better: false,
    },
    output_quality: {
      name: "terminal_equity_on_same_observed_path",
      unit: "usd",
      agent_value: agentOutput.terminal_equity_usd,
      baseline_value: baselineOutput.terminal_equity_usd,
      higher_is_better: true,
    },
    artifacts,
    trading_record: {
      window_start_at: startAt,
      window_end_at: endAt,
      wins: agentOutput.wins,
      losses: agentOutput.losses,
      flat: agentOutput.flat,
      max_drawdown_pct: agentOutput.max_drawdown_pct,
      gross_return_pct: agentOutput.gross_return_pct,
      net_return_pct: agentOutput.net_return_pct,
      risk_basis: "Paper grid on immutable Chainlink BNB/USD rounds; wins/losses/flat are mark-to-market interval outcomes, not realized trade PnL.",
      execution_environment: "OBSERVED_MARKET_DATA_REPLAY",
    },
    limitations: [
      "Historical observed-data replay; the promise did not predate the historical market window.",
      "No BNB mainnet transaction or user capital was used.",
      "Paper execution return is not realized mainnet PnL and does not predict future performance.",
      "This dry run is intentionally not countable for the final Agent Advantage report.",
    ],
    claim_guardrail: "OBSERVED means the task inputs, execution measurements and attached outputs are preserved from an actual measured run or observed-data replay. It does not imply realized mainnet profit or guarantee future performance.",
  } as const;

  const validated = validateObservedPairBundle(bundle);
  const report = buildValidatedObservedAdvantageReport([validated]);
  assert(validated.marketplace_hire.countable_for_final_report === false, "dry run unexpectedly became countable");
  assert(report.paired_run_count === 0, "dry run must not increase final paired-run count");
  assert(report.status === "INSUFFICIENT_OBSERVED_EVIDENCE", "dry run must not make final report READY");

  await save("pair-bundle.json", validated);
  const result = {
    schema: "spondee.g5-grid-observed-pair-dry-run.v1",
    pair_id: pairId,
    scenario_id: scenarioId,
    source_network: "bsc-mainnet",
    source_feed: FEED,
    source_block: blockNumber.toString(),
    observed_round_count: rounds.length,
    observation_window: { start_at: startAt, end_at: endAt },
    agent_output: agentOutput,
    baseline_output: baselineOutput,
    structural_pair_validation: "PASS",
    external_observed_provenance: true,
    marketplace_hire_semantics_status: "DRY_RUN_REFERENCE_AGENT_ONLY__LIVE_MARKETPLACE_ACTIVATION_STILL_REQUIRED",
    countable_for_final_report: false,
    final_report_paired_run_count_after_dry_run: report.paired_run_count,
    final_report_status_after_dry_run: report.status,
    wallet_used: false,
    chain_write_attempted: false,
    user_capital_used: false,
    realized_mainnet_pnl_claimed: false,
    conclusion: "SPONDEE_G5_GRID_OBSERVED_PAIR_DRY_RUN_PASS",
  } as const;
  await save("dry-run-result.json", result);
  console.log(JSON.stringify(result, null, 2));
}

await main();
