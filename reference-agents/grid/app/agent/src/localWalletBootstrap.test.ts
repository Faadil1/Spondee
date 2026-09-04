import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { bootstrapLocalWallet } from "./localWalletBootstrap.js";

const TEST_PASSWORD = "Spondee-CI-Only-Password-2026";

test("official BNB SDK creates, persists, reloads and signs with a Keystore V3", async () => {
  const root = mkdtempSync(join(tmpdir(), "spondee-wallet-test-"));
  const previousPassword = process.env.WALLET_PASSWORD;
  const previousDir = process.env.SPONDEE_WALLETS_DIR;

  process.env.WALLET_PASSWORD = TEST_PASSWORD;
  process.env.SPONDEE_WALLETS_DIR = root;

  try {
    const created = await bootstrapLocalWallet("create");
    assert.match(created.address, /^0x[a-fA-F0-9]{40}$/);
    assert.equal(created.source, "created_new");
    assert.equal(EVMWalletProvider.listWallets(root).length, 1);
    assert.equal(
      EVMWalletProvider.listWallets(root)[0]?.toLowerCase(),
      created.address.toLowerCase(),
    );

    const verified = await bootstrapLocalWallet("verify");
    assert.equal(verified.address.toLowerCase(), created.address.toLowerCase());
    assert.equal(verified.source, "loaded_keystore");

    await assert.rejects(
      () => bootstrapLocalWallet("create"),
      /Refusing to create a second wallet/,
    );
  } finally {
    if (previousPassword === undefined) delete process.env.WALLET_PASSWORD;
    else process.env.WALLET_PASSWORD = previousPassword;

    if (previousDir === undefined) delete process.env.SPONDEE_WALLETS_DIR;
    else process.env.SPONDEE_WALLETS_DIR = previousDir;

    rmSync(root, { recursive: true, force: true });
  }
});
