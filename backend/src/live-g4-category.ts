import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { getAddress } from "viem";
import { TaskSchema, type SpondeeTask } from "./contracts.js";
import { BSC_TESTNET, type LiveActivationProgress } from "./erc8183.js";
import {
  runSignedZeroPriceCategoryTestnetActivation,
  supportsSpondeeLiveTask,
} from "./category-erc8183.js";

const EXPECTED_PROVIDER = getAddress(
  process.env.SPONDEE_PROVIDER_ADDRESS ??
    "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8",
);

const EXPECTED_SCHEMAS = {
  grid: "spondee.grid.task.v1",
  rebalancing: "spondee.rebalancing.task.v1",
  yield: "spondee.yield.task.v1",
} as const;

type G4Category = keyof typeof EXPECTED_SCHEMAS;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function categoryFromEnv(): G4Category {
  const raw = process.env.SPONDEE_G4_CATEGORY?.trim() ?? "";
  if (raw === "grid" || raw === "rebalancing" || raw === "yield") return raw;
  throw new Error("SPONDEE_G4_CATEGORY must be one of: grid, rebalancing, yield");
}

async function rpcBalance(address: `0x${string}`): Promise<bigint> {
  const response = await fetch(BSC_TESTNET.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  assert(response.ok, `BSC testnet RPC HTTP ${response.status}`);
  const payload = (await response.json()) as {
    result?: string;
    error?: { message?: string };
  };
  if (!payload.result) {
    throw new Error(`BSC testnet balance RPC failed: ${payload.error?.message ?? "unknown"}`);
  }
  return BigInt(payload.result);
}

async function writeEvidence(path: string | null, value: unknown): Promise<void> {
  const json = JSON.stringify(value, null, 2);
  if (path) await writeFile(path, `${json}\n`, "utf8");
  console.log(json);
}

async function main(): Promise<void> {
  assert(
    process.env.SPONDEE_LIVE_TESTNET_ENABLED === "true",
    "SPONDEE_LIVE_TESTNET_ENABLED=true is required for the bounded G4 live runner",
  );
  assert(
    process.env.BNBAGENT_USE_PAYMASTER === "1",
    "BNBAGENT_USE_PAYMASTER=1 is required; the G4 gate is MegaFuel-backed",
  );

  const category = categoryFromEnv();
  const sellerUrl = process.env.SPONDEE_SELLER_A2A_URL?.trim() ?? "";
  assert(sellerUrl.length > 0, "SPONDEE_SELLER_A2A_URL is required");
  const taskPathRaw = process.env.SPONDEE_G4_TASK_PATH?.trim() ?? "";
  assert(taskPathRaw.length > 0, "SPONDEE_G4_TASK_PATH is required");
  const taskPath = resolve(taskPathRaw);
  const task = TaskSchema.parse(JSON.parse(await readFile(taskPath, "utf8"))) as SpondeeTask;
  assert(
    task.schema === EXPECTED_SCHEMAS[category],
    `${category} live runner expected ${EXPECTED_SCHEMAS[category]}, received ${task.schema}`,
  );
  assert(supportsSpondeeLiveTask(task), `unsupported live task schema: ${task.schema}`);

  const buyerDir = await mkdtemp(join(tmpdir(), `spondee-g4-${category}-buyer-`));
  const buyerPassword = `${randomBytes(32).toString("hex")}Aa1!`;
  const bootstrapWallet = new EVMWalletProvider({
    password: buyerPassword,
    walletsDir: buyerDir,
    persist: true,
  });
  const buyerAddress = getAddress(bootstrapWallet.address);
  bootstrapWallet.destroy();

  const progress: LiveActivationProgress[] = [];
  const publicEvidencePath = process.env.SPONDEE_LIVE_EVIDENCE_PATH?.trim() || null;
  const startedAt = new Date().toISOString();

  try {
    const balanceBefore = await rpcBalance(buyerAddress);
    assert(
      balanceBefore === 0n,
      `ephemeral buyer unexpectedly has ${balanceBefore} wei; refusing user-funded gas`,
    );

    const activationEnv: NodeJS.ProcessEnv = {
      ...process.env,
      SPONDEE_LIVE_TESTNET_ENABLED: "true",
      SPONDEE_SELLER_A2A_URL: sellerUrl,
      SPONDEE_PROVIDER_ADDRESS: EXPECTED_PROVIDER,
      BUYER_WALLET_ADDRESS: buyerAddress,
      BUYER_WALLETS_DIR: buyerDir,
      BUYER_WALLET_PASSWORD: buyerPassword,
      BNBAGENT_USE_PAYMASTER: "1",
    };

    const result = await runSignedZeroPriceCategoryTestnetActivation(
      task,
      activationEnv,
      async (event) => {
        progress.push(event);
        console.error(
          `[g4-${category}] ${event.stage} job=${event.job_id}${
            event.transaction_hash ? ` tx=${event.transaction_hash}` : ""
          }`,
        );
      },
    );

    const balanceAfter = await rpcBalance(buyerAddress);
    assert(
      balanceAfter === 0n,
      `ephemeral buyer balance changed to ${balanceAfter} wei; MegaFuel boundary failed`,
    );

    await writeEvidence(publicEvidencePath, {
      schema: "spondee.g4-category-megafuel-live-e2e.v1",
      category,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      network: "bsc-testnet",
      chain_id: 97,
      provider_address: EXPECTED_PROVIDER,
      buyer_address: buyerAddress,
      buyer_balance_before_wei: balanceBefore.toString(),
      buyer_balance_after_wei: balanceAfter.toString(),
      buyer_private_key_persisted_after_run: false,
      buyer_private_key_printed: false,
      service_price_raw: "0",
      paymaster_mode: "MEGAFUEL_PRIMARY",
      task_schema: task.schema,
      scenario_id: task.scenario_id,
      progress,
      result,
      observed_agent_advantage_claimed: false,
      conclusion: `SPONDEE_G4_${category.toUpperCase()}_MEGAFUEL_LIVE_E2E_PASS`,
    });
  } catch (error) {
    const failure = {
      schema: "spondee.g4-category-megafuel-live-e2e.failure.v1",
      category,
      started_at: startedAt,
      failed_at: new Date().toISOString(),
      network: "bsc-testnet",
      chain_id: 97,
      provider_address: EXPECTED_PROVIDER,
      buyer_address: buyerAddress,
      task_schema: task.schema,
      scenario_id: task.scenario_id,
      progress,
      error: error instanceof Error ? error.message : String(error),
      secrets_printed: false,
      observed_agent_advantage_claimed: false,
      conclusion: `SPONDEE_G4_${category.toUpperCase()}_MEGAFUEL_LIVE_E2E_FAIL_CLOSED`,
    };
    const json = JSON.stringify(failure, null, 2);
    if (publicEvidencePath) await writeFile(publicEvidencePath, `${json}\n`, "utf8");
    console.error(json);
    process.exitCode = 1;
  } finally {
    await rm(buyerDir, { recursive: true, force: true });
  }
}

await main();
