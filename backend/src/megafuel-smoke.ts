import { randomUUID } from "node:crypto";
import { ERC8183Client, ERC8183_PAYMASTER_CHAIN_IDS } from "@bnbagent/sdk/erc8183";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";

const PROVIDER = getAddress("0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  assert(
    ERC8183_PAYMASTER_CHAIN_IDS.has(97),
    "Pinned @bnbagent/sdk does not mark BSC Testnet chain 97 as ERC-8183 paymaster supported",
  );

  // Ephemeral in-memory key. Never persisted and never printed.
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const wallet = new EVMWalletProvider({
    password: randomUUID(),
    privateKey,
    persist: false,
  });

  try {
    const client = await ERC8183Client.create({
      walletProvider: wallet,
      network: "bsc-testnet",
    });

    assert(client.network.chainId === 97, `expected chain 97, got ${client.network.chainId}`);
    assert(client.network.usePaymaster === true, "BSC Testnet preset did not enable the paymaster");
    assert(Boolean(client.network.paymasterUrl), "BSC Testnet preset has no paymaster URL");

    const before = await client.publicClient.getBalance({ address: account.address });
    assert(before === 0n, `ephemeral wallet unexpectedly had ${before} wei before test`);

    const disputeWindow = await client.policy.disputeWindow();
    const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + disputeWindow + 3600n;
    const description = JSON.stringify({
      schema: "spondee.megafuel-smoke.v1",
      purpose: "prove ERC-8183 write sponsorship from a zero-tBNB ephemeral client",
      service_price_raw: "0",
      evidence_class: "TESTNET_INFRASTRUCTURE_PROBE",
      no_user_funds: true,
    });

    const created = await client.createJob({
      provider: PROVIDER,
      expiredAt,
      description,
    });
    assert(created.status === 1, "createJob transaction did not succeed");
    assert(created.jobId !== null, "createJob returned no jobId");

    const jobId = created.jobId;
    const createdJob = await client.getJob(jobId);
    assert(getAddress(createdJob.client) === getAddress(account.address), "created job client mismatch");
    assert(getAddress(createdJob.provider) === PROVIDER, "created job provider mismatch");

    // Clean up the zero-value infrastructure probe. This is a second sponsored write.
    const cancelled = await client.cancelOpen(jobId);
    assert(cancelled.status === 1, "cancelOpen transaction did not succeed");

    const after = await client.publicClient.getBalance({ address: account.address });
    assert(after === 0n, `ephemeral wallet balance changed to ${after} wei; zero-balance sponsorship not proven`);

    const result = {
      schema: "spondee.megafuel-smoke-result.v1",
      network: client.network.name,
      chain_id: client.network.chainId,
      paymaster_enabled: client.network.usePaymaster,
      paymaster_url_configured: Boolean(client.network.paymasterUrl),
      ephemeral_client_address: account.address,
      balance_before_wei: before.toString(),
      balance_after_wei: after.toString(),
      provider_address: PROVIDER,
      job_id: jobId.toString(),
      create_job_tx: created.transactionHash,
      cancel_open_tx: cancelled.transactionHash,
      create_status: created.status,
      cancel_status: cancelled.status,
      no_user_funds: true,
      private_key_persisted: false,
      private_key_printed: false,
      conclusion: "MEGAFUEL_ERC8183_ZERO_BALANCE_SPONSORSHIP_PASS",
    };

    console.log(JSON.stringify(result, null, 2));
  } finally {
    wallet.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
