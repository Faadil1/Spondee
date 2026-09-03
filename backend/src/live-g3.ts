import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { getAddress } from "viem";
import type { SpondeeTask } from "./contracts.js";
import {
  BSC_TESTNET,
  type LiveActivationProgress,
  runSignedZeroPriceTestnetActivation,
} from "./erc8183.js";

const EXPECTED_PROVIDER = getAddress(
  process.env.SPONDEE_PROVIDER_ADDRESS ??
    "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8",
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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

async function main(): Promise<void> {
  assert(
    process.env.SPONDEE_LIVE_TESTNET_ENABLED === "true",
    "SPONDEE_LIVE_TESTNET_ENABLED=true is required for the bounded live testnet runner",
  );
  const sellerUrl = process.env.SPONDEE_SELLER_A2A_URL?.trim() ?? "";
  assert(sellerUrl.length > 0, "SPONDEE_SELLER_A2A_URL is required");
  assert(
    process.env.BNBAGENT_USE_PAYMASTER === "1",
    "BNBAGENT_USE_PAYMASTER=1 is required; this gate is explicitly MegaFuel-backed",
  );

  const taskPath = resolve(
    process.env.SPONDEE_G3_TASK_PATH ??
      "../reference-agents/health-factor/demo/health-factor-scenario.json",
  );
  const task = JSON.parse(await readFile(taskPath, "utf8")) as SpondeeTask;
  assert(
    task.schema === "spondee.health-factor.task.v1",
    "G3 live runner accepts only the canonical Health Factor task",
  );

  const buyerDir = await mkdtemp(join(tmpdir(), "spondee-g3-buyer-"));
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
      `ephemeral buyer unexpectedly has ${balanceBefore} wei; refusing to use user-funded gas in the MegaFuel proof`,
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

    const result = await runSignedZeroPriceTestnetActivation(
      task,
      activationEnv,
      async (event) => {
        progress.push(event);
        console.error(
          `[g3-live] ${event.stage} job=${event.job_id}${
            event.transaction_hash ? ` tx=${event.transaction_hash}` : ""
          }`,
        );
      },
    );

    const balanceAfter = await rpcBalance(buyerAddress);
    assert(
      balanceAfter === 0n,
      `ephemeral buyer balance changed to ${balanceAfter} wei; MegaFuel zero-balance boundary was not preserved`,
    );

    const evidence = {
      schema: "spondee.g3-megafuel-health-factor-live-e2e.v1",
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
      conclusion: "SPONDEE_G3_MEGAFUEL_BACKED_HEALTH_FACTOR_LIVE_E2E_PASS",
    };

    const json = JSON.stringify(evidence, null, 2);
    if (publicEvidencePath) {
      await writeFile(publicEvidencePath, `${json}\n`, "utf8");
    }
    console.log(json);
  } catch (error) {
    const failure = {
      schema: "spondee.g3-megafuel-health-factor-live-e2e.failure.v1",
      started_at: startedAt,
      failed_at: new Date().toISOString(),
      network: "bsc-testnet",
      chain_id: 97,
      provider_address: EXPECTED_PROVIDER,
      buyer_address: buyerAddress,
      progress,
      error: error instanceof Error ? error.message : String(error),
      secrets_printed: false,
      conclusion: "SPONDEE_G3_MEGAFUEL_BACKED_HEALTH_FACTOR_LIVE_E2E_FAIL_CLOSED",
    };
    const json = JSON.stringify(failure, null, 2);
    if (publicEvidencePath) {
      await writeFile(publicEvidencePath, `${json}\n`, "utf8");
    }
    console.error(json);
    process.exitCode = 1;
  } finally {
    await rm(buyerDir, { recursive: true, force: true });
  }
}

await main();
