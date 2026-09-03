import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";

export type WalletBootstrapMode = "create" | "verify";

export interface WalletBootstrapResult {
  address: `0x${string}`;
  mode: WalletBootstrapMode;
  source: string;
  keyLocation: string | null;
}

function requirePassword(): string {
  const password = process.env.WALLET_PASSWORD ?? "";
  if (password.length < 12) {
    throw new Error(
      "WALLET_PASSWORD must be present in the local process and contain at least 12 characters.",
    );
  }
  return password;
}

export function resolveSpondeeWalletDir(): string {
  const override = process.env.SPONDEE_WALLETS_DIR?.trim();
  return override
    ? resolve(override)
    : resolve(process.cwd(), "../../.studio/wallets");
}

/**
 * Create or verify the Spondee throwaway BSC-testnet wallet using the official
 * @bnbagent/sdk EVMWalletProvider directly. This deliberately avoids the
 * globally installed Agent Studio CLI, which is not part of the deployed
 * runtime and may be temporarily unavailable because of npm publication drift.
 *
 * Security invariants:
 * - password arrives only through the process environment;
 * - no private key or keystore JSON is printed or returned;
 * - create mode refuses to overwrite/reuse an existing wallet directory;
 * - verify mode performs only a local EIP-191 message signature, never a tx;
 * - callers should invoke destroy() indirectly by letting this function finish.
 */
export async function bootstrapLocalWallet(
  mode: WalletBootstrapMode,
): Promise<WalletBootstrapResult> {
  const password = requirePassword();
  const walletsDir = resolveSpondeeWalletDir();
  mkdirSync(walletsDir, { recursive: true });

  const existing = EVMWalletProvider.listWallets(walletsDir);

  if (mode === "create") {
    if (existing.length > 0) {
      throw new Error(
        `Refusing to create a second wallet: ${existing.length} encrypted keystore(s) already exist in the Spondee wallet directory. Use verify mode instead.`,
      );
    }

    const wallet = new EVMWalletProvider({
      password,
      walletsDir,
      persist: true,
    });

    try {
      if (wallet.source !== "created_new") {
        throw new Error(`Expected source=created_new, received ${wallet.source}.`);
      }
      if (!wallet.exists()) {
        throw new Error("BNB SDK created a wallet but did not persist its encrypted keystore.");
      }

      return {
        address: wallet.address,
        mode,
        source: wallet.source,
        keyLocation: wallet.keyLocation,
      };
    } finally {
      wallet.destroy();
    }
  }

  if (existing.length !== 1) {
    throw new Error(
      `Verify mode requires exactly one encrypted keystore; found ${existing.length}.`,
    );
  }

  const expectedAddress = existing[0] as `0x${string}`;
  const wallet = new EVMWalletProvider({
    password,
    address: expectedAddress,
    walletsDir,
    persist: true,
  });

  try {
    if (wallet.address.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error("Reloaded wallet address does not match the persisted keystore address.");
    }
    if (!wallet.exists()) {
      throw new Error("Persisted encrypted keystore disappeared during verification.");
    }

    // Local-only proof that the supplied password really unlocks signing.
    // No chain connection or transaction is involved, and the signature is not printed.
    await wallet.signMessage("Spondee G3 local wallet verification - no transaction");

    return {
      address: wallet.address,
      mode,
      source: wallet.source,
      keyLocation: wallet.keyLocation,
    };
  } finally {
    wallet.destroy();
  }
}

async function main(): Promise<void> {
  const rawMode = process.argv[2] ?? "";
  if (rawMode !== "create" && rawMode !== "verify") {
    throw new Error("Usage: localWalletBootstrap.ts <create|verify>");
  }

  const result = await bootstrapLocalWallet(rawMode);

  // Public/non-secret output only. Never add private-key/keystore exports here.
  console.log("SPONDEE_G3_WALLET_OK");
  console.log(`mode=${result.mode}`);
  console.log(`source=${result.source}`);
  console.log(`public_address=${result.address}`);
  console.log("keystore=encrypted_v3_persisted_locally");
  console.log("network_scope=bsc-testnet-only");
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Spondee G3 wallet bootstrap] ${message}`);
    process.exitCode = 1;
  });
}
