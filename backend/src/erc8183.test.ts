import assert from "node:assert/strict";
import test from "node:test";
import { BSC_TESTNET, liveGateStatus } from "./erc8183.js";

test("live ERC-8183 execution is disabled by default", () => {
  const gate = liveGateStatus({});
  assert.equal(gate.enabled, false);
  assert.equal(gate.ready_for_live_write, false);
});

test("even an enable flag alone cannot open the live gate", () => {
  const gate = liveGateStatus({ SPONDEE_LIVE_TESTNET_ENABLED: "true" });
  assert.equal(gate.enabled, true);
  assert.equal(gate.ready_for_live_write, false);
});

test("BSC testnet contract anchors are explicit and chain id is 97", () => {
  assert.equal(BSC_TESTNET.chainId, 97);
  for (const address of [
    BSC_TESTNET.identityRegistry,
    BSC_TESTNET.commerce,
    BSC_TESTNET.evaluatorRouter,
    BSC_TESTNET.optimisticPolicy,
  ]) {
    assert.match(address, /^0x[a-fA-F0-9]{40}$/);
  }
});
