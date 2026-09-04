import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { createPublicClient, getAddress, http } from "viem";
import {
  G5_GRID_FEED,
  G5GridForwardTaskSchema,
  evaluateForwardBaseline,
  sha256Hex,
  type G5GridForwardTask,
} from "./g5-grid-forward.js";
import { runG5GridForwardActivation } from "./g5-grid-forward-erc8183.js";
import {
  buildValidatedObservedAdvantageReport,
  sha256Evidence,
  validateObservedPairBundle,
} from "./observed-evidence.js";
import { BSC_TESTNET, type LiveActivationProgress } from "./erc8183.js";

const EXPECTED_PROVIDER = getAddress(process.env.SPONDEE_PROVIDER_ADDRESS ?? "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8");
const MAINNET_RPC = process.env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org";
const feedAbi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ] },
] as const;

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function json(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n`; }
async function save(dir: string, name: string, value: unknown) {
  const content = json(value); const path = resolve(dir, name); await writeFile(path, content, "utf8");
  return { path, sha256: sha256Evidence(content) };
}
async function rpcBalance(address: `0x${string}`): Promise<bigint> {
  const response = await fetch(BSC_TESTNET.rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBalance", params: [address, "latest"] }), signal: AbortSignal.timeout(10_000) });
  assert(response.ok, `BSC testnet balance RPC HTTP ${response.status}`);
  const payload = await response.json() as { result?: string; error?: { message?: string } };
  if (!payload.result) throw new Error(`BSC testnet balance RPC failed: ${payload.error?.message ?? "unknown"}`);
  return BigInt(payload.result);
}

async function freezeTask(): Promise<G5GridForwardTask> {
  const client = createPublicClient({ transport: http(MAINNET_RPC, { timeout: 15_000 }) });
  assert(await client.getChainId() === 56, "freeze source must be BSC mainnet");
  const [decimals, description, latest] = await Promise.all([
    client.readContract({ address: getAddress(G5_GRID_FEED), abi: feedAbi, functionName: "decimals" }),
    client.readContract({ address: getAddress(G5_GRID_FEED), abi: feedAbi, functionName: "description" }),
    client.readContract({ address: getAddress(G5_GRID_FEED), abi: feedAbi, functionName: "latestRoundData" }),
  ]);
  assert(String(description).toUpperCase().includes("BNB"), `unexpected feed: ${description}`);
  const [roundId, answer, , updatedAt] = latest;
  assert(answer > 0n && updatedAt > 0n, "invalid freeze round");
  const frozenAt = new Date().toISOString();
  return G5GridForwardTaskSchema.parse({
    schema: "spondee.grid-forward-observed.task.v1",
    scenario_id: `g5-grid-forward-${roundId.toString()}-${Date.now()}`,
    evidence_class: "OBSERVED",
    source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_GRID_FEED, feed_description: "BNB / USD" },
    freeze: { round_id: roundId.toString(), price_usd: Number(answer) / 10 ** Number(decimals), updated_at: new Date(Number(updatedAt) * 1000).toISOString(), frozen_at: frozenAt },
    observation_rule: { only_rounds_after_activation: true, target_future_rounds: 8, max_wait_seconds: 480, poll_seconds: 5 },
    strategy: { capital_usd: 10000, starting_allocation: "50% USD / 50% BNB", levels: 9, half_width_pct: 0.15, fee_bps: 10, slippage_bps: 5, baseline: "STATIC_50_50_BUY_AND_HOLD" },
    claim_guardrail: "Forward observed-market-data task only. No mainnet trade is executed; paper returns are not realized PnL and do not guarantee future performance.",
  });
}

async function main() {
  assert(process.env.SPONDEE_G5_GRID_FORWARD_EXECUTION_ENABLED === "true", "explicit G5 Grid forward execution authorization flag is required");
  assert(process.env.SPONDEE_LIVE_TESTNET_ENABLED === "true", "SPONDEE_LIVE_TESTNET_ENABLED=true is required");
  assert(process.env.BNBAGENT_USE_PAYMASTER === "1", "MegaFuel is required");
  const sellerUrl = process.env.SPONDEE_G5_GRID_FORWARD_SELLER_URL?.trim() ?? "";
  assert(sellerUrl.length > 0, "SPONDEE_G5_GRID_FORWARD_SELLER_URL is required");
  const outputDir = resolve(process.env.SPONDEE_G5_OUTPUT_DIR?.trim() || `.g5-grid-forward-${Date.now()}`);
  await mkdir(outputDir, { recursive: true });

  const task = await freezeTask();
  const buyerDir = await mkdtemp(join(tmpdir(), "spondee-g5-grid-forward-buyer-"));
  const buyerPassword = `${randomBytes(32).toString("hex")}Aa1!`;
  const bootstrap = new EVMWalletProvider({ password: buyerPassword, walletsDir: buyerDir, persist: true });
  const buyerAddress = getAddress(bootstrap.address); bootstrap.destroy();
  const progress: LiveActivationProgress[] = [];
  const startedAt = new Date().toISOString();

  try {
    const balanceBefore = await rpcBalance(buyerAddress);
    assert(balanceBefore === 0n, `ephemeral buyer unexpectedly has ${balanceBefore} wei`);
    const activationEnv: NodeJS.ProcessEnv = {
      ...process.env,
      SPONDEE_G5_GRID_FORWARD_EXECUTION_ENABLED: "true",
      SPONDEE_LIVE_TESTNET_ENABLED: "true",
      SPONDEE_G5_GRID_FORWARD_SELLER_URL: sellerUrl,
      SPONDEE_PROVIDER_ADDRESS: EXPECTED_PROVIDER,
      BUYER_WALLET_ADDRESS: buyerAddress,
      BUYER_WALLETS_DIR: buyerDir,
      BUYER_WALLET_PASSWORD: buyerPassword,
      BNBAGENT_USE_PAYMASTER: "1",
    };
    const result = await runG5GridForwardActivation(task, activationEnv, (event) => {
      progress.push(event);
      console.error(`[g5-grid-forward] ${event.stage} job=${event.job_id}${event.transaction_hash ? ` tx=${event.transaction_hash}` : ""}`);
    });
    const balanceAfter = await rpcBalance(buyerAddress);
    assert(balanceAfter === 0n, `ephemeral buyer balance changed to ${balanceAfter} wei`);

    const baselineStart = performance.now();
    const baseline = evaluateForwardBaseline(task, result.agent_output.rounds);
    const baselineComputeSeconds = (performance.now() - baselineStart) / 1000;
    assert(sha256Hex(baseline) === sha256Hex(result.baseline_output), "independent baseline recomputation mismatch");

    const firstRound = result.agent_output.rounds[0]!;
    const lastRound = result.agent_output.rounds.at(-1)!;
    const observationSeconds = (Date.parse(lastRound.updated_at) - Date.parse(firstRound.updated_at)) / 1000;
    const agentPostWindowSeconds = Math.max(0, (Date.parse(result.agent_output.observation_completed_at) - Date.parse(lastRound.updated_at)) / 1000);
    const agentCompletionSeconds = observationSeconds + agentPostWindowSeconds;
    const baselineCompletionSeconds = observationSeconds + baselineComputeSeconds;
    const pairId = `g5-grid-forward-job-${result.job_id}`;
    const initialState = {
      capital_usd: task.strategy.capital_usd,
      starting_allocation: task.strategy.starting_allocation,
      freeze_round_id: task.freeze.round_id,
      freeze_price_usd: task.freeze.price_usd,
      levels: task.strategy.levels,
      half_width_pct: task.strategy.half_width_pct,
      fee_bps: task.strategy.fee_bps,
      slippage_bps: task.strategy.slippage_bps,
    };
    const inputSnapshot = {
      schema: "spondee.g5-grid-forward-input-snapshot.v1",
      pair_id: pairId,
      scenario_id: task.scenario_id,
      task,
      initial_state: initialState,
      marketplace: { network: "bsc-testnet", chain_id: 97, job_id: result.job_id, provider_address: result.provider_address, funded_at: result.funded_at },
      claim_guardrail: task.claim_guardrail,
    };
    const inputArtifact = await save(outputDir, "input-snapshot.json", inputSnapshot);
    const marketArtifact = await save(outputDir, "market-data.json", { source: task.source, rounds: result.agent_output.rounds });
    const agentArtifact = await save(outputDir, "agent-output.json", result.agent_output);
    const baselineArtifact = await save(outputDir, "baseline-output.json", baseline);
    const timingArtifact = await save(outputDir, "timing-log.json", { metric: "task_completion_from_first_observed_round", unit: "seconds", shared_observation_window_seconds: observationSeconds, agent_post_window_seconds: agentPostWindowSeconds, baseline_compute_seconds: baselineComputeSeconds, agent_value: agentCompletionSeconds, baseline_value: baselineCompletionSeconds });
    const costArtifact = await save(outputDir, "cost-log.json", { unit: "usd", service_price_raw: "0", buyer_wallet_paid_wei: "0", agent_paper_execution_friction_usd: result.agent_output.strategy_result.estimated_execution_friction_usd, baseline_execution_friction_usd: 0, mainnet_value_moved: false });
    const transactionArtifact = await save(outputDir, "transaction-tape.json", { network: "bsc-testnet", chain_id: 97, job_id: result.job_id, provider_address: result.provider_address, buyer_address: result.buyer_address, funded_at: result.funded_at, transactions: result.transactions, buyer_balance_before_wei: balanceBefore.toString(), buyer_balance_after_wei: balanceAfter.toString(), megafuel: true });

    const artifact = (kind: string, id: string, saved: { path: string; sha256: string }, sourceType: string, locator: string) => ({ artifact_id: id, kind, uri: `file://${saved.path.replaceAll("\\", "/")}`, sha256: saved.sha256, captured_at: new Date().toISOString(), source_type: sourceType, source_locator: locator });
    const baselineRunId = `${pairId}-baseline`;
    const agentRunId = `${pairId}-agent`;
    const txHashes = Object.values(result.transactions);
    const bundle = {
      schema: "spondee.agent-advantage-pair.v1",
      pair_id: pairId,
      frozen_at: task.freeze.frozen_at,
      category: "Grid Trading",
      scenario_id: task.scenario_id,
      observation_mode: "LIVE_PUBLIC_DATA_TASK",
      observation_window: { start_at: firstRound.updated_at, end_at: lastRound.updated_at },
      initial_state_sha256: `sha256:${sha256Hex(initialState)}`,
      input_snapshot_sha256: inputArtifact.sha256,
      marketplace_hire: { mode: "LIVE_BSC_TESTNET_MARKETPLACE", agent_transport: "ERC8183_BSC_TESTNET", promise_before_observation: true, activation_reference: `bsc-testnet:erc8183:job:${result.job_id}`, countable_for_final_report: true },
      agent_run: {
        run_id: agentRunId, category: "Grid Trading", scenario_id: task.scenario_id, agent_id: "spondee-grid-forward-observed-v1", version: "g5-grid-forward-v1", evidence_class: "OBSERVED",
        promise_timestamp: task.freeze.frozen_at, expected_outcome: { promise_id: result.promise.promise_id, method: "bounded symmetric Grid on future Chainlink rounds", no_profit_promise: true }, confidence: null,
        expected_downside: { paper_execution: true, mainnet_value_moved: false, realized_mainnet_pnl: false }, expected_cost: { service_price_raw: "0", paper_friction_model: "fee_bps + slippage_bps" },
        tx_hashes: txHashes, actual_outcome: result.agent_output.strategy_result, actual_cost: { service_price_raw: "0", wallet_paid_wei: "0", estimated_execution_friction_usd: result.agent_output.strategy_result.estimated_execution_friction_usd },
        output_artifacts: [`${pairId}-agent-output`, `${pairId}-timing`, `${pairId}-cost`, `${pairId}-transactions`], baseline_type: "WITHOUT_AGENT_STATIC_50_50_BUY_AND_HOLD", baseline_run_id: baselineRunId,
        advantage_delta: { terminal_equity_usd: result.agent_output.strategy_result.terminal_equity_usd - baseline.terminal_equity_usd, net_return_pct: result.agent_output.strategy_result.net_return_pct - baseline.net_return_pct, max_drawdown_pct: result.agent_output.strategy_result.max_drawdown_pct - baseline.max_drawdown_pct },
        calibration_error: null, notes: "Countable forward observed pair: marketplace activation precedes future observed market window; no mainnet value moved.",
      },
      baseline_run: {
        run_id: baselineRunId, category: "Grid Trading", scenario_id: task.scenario_id, agent_id: "without-agent-static-50-50", version: "g5-grid-forward-baseline-v1", evidence_class: "OBSERVED",
        promise_timestamp: task.freeze.frozen_at, expected_outcome: { method: "static 50/50 hold on same future window" }, confidence: null, expected_downside: { market_exposure: true }, expected_cost: { amount_usd: 0 }, tx_hashes: [],
        actual_outcome: baseline, actual_cost: { amount_usd: 0 }, output_artifacts: [`${pairId}-baseline-output`, `${pairId}-timing`, `${pairId}-cost`], baseline_type: null, baseline_run_id: null, advantage_delta: null, calibration_error: null,
        notes: "Without-agent baseline computed from the exact independently verified forward Chainlink rounds.",
      },
      time_seconds: { name: "task_completion_from_first_observed_round", unit: "seconds", agent_value: agentCompletionSeconds, baseline_value: baselineCompletionSeconds, higher_is_better: false },
      cost: { name: "estimated_execution_friction", unit: "usd", agent_value: result.agent_output.strategy_result.estimated_execution_friction_usd, baseline_value: 0, higher_is_better: false },
      output_quality: { name: "terminal_equity_on_same_forward_observed_path", unit: "usd", agent_value: result.agent_output.strategy_result.terminal_equity_usd, baseline_value: baseline.terminal_equity_usd, higher_is_better: true },
      artifacts: [
        artifact("INPUT_SNAPSHOT", `${pairId}-input`, inputArtifact, "BSC_MAINNET_RPC_READ_ONLY", `chainlink:${G5_GRID_FEED}:freeze:${task.freeze.round_id}`),
        artifact("MARKET_DATA", `${pairId}-market`, marketArtifact, "BSC_MAINNET_RPC_READ_ONLY", `chainlink:${G5_GRID_FEED}:rounds:${firstRound.round_id}-${lastRound.round_id}`),
        artifact("AGENT_OUTPUT", `${pairId}-agent-output`, agentArtifact, "BSC_TESTNET_RPC", `erc8183:job:${result.job_id}:submit:${result.transactions.submit}`),
        artifact("BASELINE_OUTPUT", `${pairId}-baseline-output`, baselineArtifact, "LOCAL_RUNTIME_MEASUREMENT", "local:without-agent-baseline"),
        artifact("TIMING_LOG", `${pairId}-timing`, timingArtifact, "LOCAL_RUNTIME_MEASUREMENT", "local:g5-forward-timing"),
        artifact("COST_LOG", `${pairId}-cost`, costArtifact, "LOCAL_RUNTIME_MEASUREMENT", "local:g5-forward-cost"),
        artifact("TRANSACTION_TAPE", `${pairId}-transactions`, transactionArtifact, "BSC_TESTNET_RPC", `erc8183:job:${result.job_id}`),
      ],
      trading_record: { window_start_at: firstRound.updated_at, window_end_at: lastRound.updated_at, wins: result.agent_output.strategy_result.wins, losses: result.agent_output.strategy_result.losses, flat: result.agent_output.strategy_result.flat, max_drawdown_pct: result.agent_output.strategy_result.max_drawdown_pct, gross_return_pct: result.agent_output.strategy_result.gross_return_pct, net_return_pct: result.agent_output.strategy_result.net_return_pct, risk_basis: "Forward paper Grid on independently verified Chainlink BNB/USD rounds after zero-price BSC-testnet marketplace funding; no mainnet value moved.", execution_environment: "OBSERVED_MARKET_DATA_REPLAY" },
      limitations: [
        "Market observations are real forward Chainlink BNB/USD data, while strategy accounting is paper-only.",
        "No BNB mainnet transaction or user capital is used; reported returns are not realized mainnet PnL.",
        "A single observed window can favor either the agent or baseline and is not a guarantee of future performance.",
      ],
      claim_guardrail: "OBSERVED means the task inputs, execution measurements and attached outputs are preserved from an actual measured run or observed-data replay. It does not imply realized mainnet profit or guarantee future performance.",
    } as const;

    const validated = validateObservedPairBundle(bundle);
    const report = buildValidatedObservedAdvantageReport([validated]);
    assert(validated.marketplace_hire.countable_for_final_report === true, "forward marketplace pair did not become countable");
    assert(report.paired_run_count === 1, `expected exactly one countable pair, received ${report.paired_run_count}`);
    assert(report.status === "INSUFFICIENT_OBSERVED_EVIDENCE", "one pair must not make the final report READY");
    await save(outputDir, "pair-bundle.json", validated);

    const final = {
      schema: "spondee.g5-grid-forward-observed-pair.pass.v1",
      started_at: startedAt, completed_at: new Date().toISOString(), pair_id: pairId, scenario_id: task.scenario_id, job_id: result.job_id,
      provider_address: result.provider_address, buyer_address: result.buyer_address, promise_id: result.promise.promise_id, freeze_round_id: task.freeze.round_id,
      observation_window: { start_at: firstRound.updated_at, end_at: lastRound.updated_at }, observed_round_count: result.agent_output.rounds.length,
      transactions: result.transactions, manifest_hash_verified: result.manifest_hash_verified, external_round_verification: result.external_round_verification,
      buyer_balance_before_wei: balanceBefore.toString(), buyer_balance_after_wei: balanceAfter.toString(), service_price_raw: "0", mainnet_value_moved: false,
      agent_terminal_equity_usd: result.agent_output.strategy_result.terminal_equity_usd, baseline_terminal_equity_usd: baseline.terminal_equity_usd,
      countable_for_final_report: true, paired_run_count_after_pair: report.paired_run_count, final_report_status_after_pair: report.status,
      realized_mainnet_pnl_claimed: false, secrets_printed: false, output_dir: outputDir,
      conclusion: "SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_PASS",
    } as const;
    await save(outputDir, "final-result.json", final);
    console.log(JSON.stringify(final, null, 2));
  } catch (error) {
    const failure = {
      schema: "spondee.g5-grid-forward-observed-pair.failure.v1", started_at: startedAt, failed_at: new Date().toISOString(),
      provider_address: EXPECTED_PROVIDER, buyer_address: buyerAddress, progress, error: error instanceof Error ? error.message : String(error),
      mainnet_value_moved: false, secrets_printed: false, conclusion: "SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_FAIL_CLOSED",
    };
    await save(outputDir, "failure.json", failure); console.error(JSON.stringify(failure, null, 2)); process.exitCode = 1;
  } finally {
    await rm(buyerDir, { recursive: true, force: true });
  }
}

await main();
