import { createPublicClient, http, getAddress } from "viem";

const RPC = process.env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org";
const FEED = getAddress("0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE");

const abi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "description",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asIso(seconds: bigint): string {
  return new Date(Number(seconds) * 1000).toISOString();
}

async function main(): Promise<void> {
  const client = createPublicClient({ transport: http(RPC, { timeout: 15_000 }) });
  const chainId = await client.getChainId();
  assert(chainId === 56, `expected BSC mainnet chain 56, received ${chainId}`);

  const [blockNumber, decimals, description, latest] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({ address: FEED, abi, functionName: "decimals" }),
    client.readContract({ address: FEED, abi, functionName: "description" }),
    client.readContract({ address: FEED, abi, functionName: "latestRoundData" }),
  ]);

  const [latestRoundId, latestAnswer, , latestUpdatedAt] = latest;
  assert(latestAnswer > 0n, "latest Chainlink answer must be positive");
  assert(latestUpdatedAt > 0n, "latest Chainlink update timestamp must be positive");
  assert(String(description).toUpperCase().includes("BNB"), `unexpected feed description: ${description}`);

  const rounds: Array<{
    round_id: string;
    answer_raw: string;
    price_usd: number;
    updated_at: string;
  }> = [];

  // Pull a short immutable historical tail through direct view calls. No logs,
  // wallet, transaction or write method is used.
  for (let offset = 4n; offset >= 0n; offset -= 1n) {
    const roundId = latestRoundId - offset;
    try {
      const round = await client.readContract({
        address: FEED,
        abi,
        functionName: "getRoundData",
        args: [roundId],
      });
      const [observedRoundId, answer, , updatedAt] = round;
      if (answer <= 0n || updatedAt <= 0n) continue;
      rounds.push({
        round_id: observedRoundId.toString(),
        answer_raw: answer.toString(),
        price_usd: Number(answer) / 10 ** Number(decimals),
        updated_at: asIso(updatedAt),
      });
    } catch {
      // A phase boundary can make simple roundId-1 traversal unavailable.
      // The latest round still proves the live read source; require at least one.
    }
    if (offset === 0n) break;
  }

  assert(rounds.length >= 1, "no readable Chainlink BNB/USD rounds found");
  for (let i = 1; i < rounds.length; i += 1) {
    assert(
      Date.parse(rounds[i]!.updated_at) >= Date.parse(rounds[i - 1]!.updated_at),
      "Chainlink round timestamps are not monotonic",
    );
  }

  const output = {
    schema: "spondee.g5-grid-market-source-readonly.v1",
    source_type: "BSC_MAINNET_CHAINLINK_READ_ONLY",
    network: "bsc-mainnet",
    chain_id: 56,
    rpc: RPC,
    block_number: blockNumber.toString(),
    feed_address: FEED,
    feed_description: String(description),
    decimals: Number(decimals),
    round_count: rounds.length,
    rounds,
    wallet_used: false,
    chain_write_attempted: false,
    user_capital_used: false,
    eligible_as_external_observed_provenance: true,
    conclusion: "SPONDEE_G5_GRID_MARKET_SOURCE_READ_ONLY_PASS",
  } as const;

  console.log(JSON.stringify(output, null, 2));
}

await main();
