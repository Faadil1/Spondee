import { createPublicClient, getAddress, http } from "viem";
import {
  G5_GRID_FEED,
  G5GridForwardTaskSchema,
  buildG5GridForwardCommitment,
  buildG5GridForwardPromise,
  encodeG5GridForwardTask,
} from "./g5-grid-forward.js";

const RPC = process.env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org";
const abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ] },
] as const;

async function main() {
  if (process.env.SPONDEE_G5_GRID_FORWARD_EXECUTION_ENABLED === "true") {
    throw new Error("preflight refuses execution-enabled environment");
  }
  const client = createPublicClient({ transport: http(RPC, { timeout: 15_000 }) });
  const chainId = await client.getChainId();
  if (chainId !== 56) throw new Error(`expected BSC mainnet chain 56, received ${chainId}`);
  const [blockNumber, decimals, description, latest] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({ address: getAddress(G5_GRID_FEED), abi, functionName: "decimals" }),
    client.readContract({ address: getAddress(G5_GRID_FEED), abi, functionName: "description" }),
    client.readContract({ address: getAddress(G5_GRID_FEED), abi, functionName: "latestRoundData" }),
  ]);
  const [roundId, answer, , updatedAt] = latest;
  if (answer <= 0n || updatedAt <= 0n) throw new Error("invalid Chainlink latest round");
  if (!String(description).toUpperCase().includes("BNB")) throw new Error(`unexpected feed description: ${description}`);

  const frozenAt = new Date().toISOString();
  const freezeUpdatedAt = new Date(Number(updatedAt) * 1000).toISOString();
  const task = G5GridForwardTaskSchema.parse({
    schema: "spondee.grid-forward-observed.task.v1",
    scenario_id: `g5-grid-forward-${roundId.toString()}`,
    evidence_class: "OBSERVED",
    source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_GRID_FEED, feed_description: "BNB / USD" },
    freeze: {
      round_id: roundId.toString(),
      price_usd: Number(answer) / 10 ** Number(decimals),
      updated_at: freezeUpdatedAt,
      frozen_at: frozenAt,
    },
    observation_rule: {
      only_rounds_after_activation: true,
      target_future_rounds: 8,
      max_wait_seconds: 480,
      poll_seconds: 5,
    },
    strategy: {
      capital_usd: 10000,
      starting_allocation: "50% USD / 50% BNB",
      levels: 9,
      half_width_pct: 0.15,
      fee_bps: 10,
      slippage_bps: 5,
      baseline: "STATIC_50_50_BUY_AND_HOLD",
    },
    claim_guardrail: "Forward observed-market-data task only. No mainnet trade is executed; paper returns are not realized PnL and do not guarantee future performance.",
  });
  const promise = buildG5GridForwardPromise(task, "0");
  const commitment = buildG5GridForwardCommitment(promise);
  const encoded = encodeG5GridForwardTask(task);

  const result = {
    schema: "spondee.g5-grid-forward-runner-preflight.v1",
    branch_expected: "build/g5-grid-forward-observed",
    source_network: "bsc-mainnet",
    source_chain_id: 56,
    source_block: blockNumber.toString(),
    source_feed: G5_GRID_FEED,
    freeze_round_id: task.freeze.round_id,
    freeze_price_usd: task.freeze.price_usd,
    freeze_updated_at: task.freeze.updated_at,
    preflight_frozen_at: task.freeze.frozen_at,
    target_future_rounds: task.observation_rule.target_future_rounds,
    max_wait_seconds: task.observation_rule.max_wait_seconds,
    encoded_task_bytes: Buffer.byteLength(encoded, "utf8"),
    promise_id: promise.promise_id,
    promise_sha256: commitment.promise_sha256,
    service_price_raw: "0",
    marketplace_activation_mode: "ONE_NEW_BSC_TESTNET_GRID_FORWARD_JOB_LATER_HUMAN_GATE",
    observation_rule: "FIRST_COUNTED_ROUND_MUST_FOLLOW_FUNDING_AND_FREEZE",
    countable_pair_possible_only_after_live_marketplace_activation: true,
    wallet_used: false,
    chain_write_attempted: false,
    user_capital_used: false,
    mainnet_value_moved: false,
    execution_gate_open: false,
    conclusion: "SPONDEE_G5_GRID_FORWARD_RUNNER_PREFLIGHT_PASS",
  } as const;
  console.log(JSON.stringify(result, null, 2));
}

await main();
