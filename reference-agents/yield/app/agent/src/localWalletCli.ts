import { bootstrapLocalWallet, type WalletBootstrapMode } from "./localWalletBootstrap.js";

async function main(): Promise<void> {
  const rawMode = process.argv[2] ?? "";
  if (rawMode !== "create" && rawMode !== "verify") {
    throw new Error("Usage: localWalletCli.ts <create|verify>");
  }

  const result = await bootstrapLocalWallet(rawMode as WalletBootstrapMode);

  // Public/non-secret output only. Never add private-key/keystore exports here.
  console.log("SPONDEE_G3_WALLET_OK");
  console.log(`mode=${result.mode}`);
  console.log(`source=${result.source}`);
  console.log(`public_address=${result.address}`);
  console.log("keystore=encrypted_v3_persisted_locally");
  console.log("network_scope=bsc-testnet-only");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Spondee G3 wallet bootstrap] ${message}`);
  process.exitCode = 1;
});
