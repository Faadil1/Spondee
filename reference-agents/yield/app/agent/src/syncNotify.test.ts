import assert from "node:assert/strict";
import test from "node:test";
import { SellerAgentExecutor } from "./executor.js";
import type { SigningApi } from "./sellerCore.js";

const TX = `0x${"2".repeat(64)}`;
const URL = "http://127.0.0.1:9100/erc8183/job/956/response";

function fakeSigning(): SigningApi {
  return {
    listPrice: () => 0n,
    clampPrice: () => 0n,
    signQuote: async () => ({}),
    verifySignedJob: async (jobId) => ({ ok: jobId === 956, reason: jobId === 956 ? "ok" : "wrong job", permanent: true }),
    jobSpec: async () => ({ task: "SPONDEE_TASK_B64_V1:test", terms: { price: "0" } }),
    submitResult: async (jobId) => ({ submitTx: TX, deliverableUrl: URL.replace("956", String(jobId)) }),
  };
}

function executor() {
  return new SellerAgentExecutor({
    runWork: async () => "{}",
    generator: "spondee-yield",
    network: "bsc-testnet",
    commerceSkills: true,
    signing: fakeSigning(),
    pendingJobs: async () => ({ jobs: [] }),
  });
}

test("default notify_funded remains asynchronous", async () => {
  const seller = executor();
  const result = await seller.notifyFunded({ job_id: 956 });
  assert.equal(result.status, "accepted");
  assert.equal(result.job_id, 956);
  assert.equal("tx_hash" in result, false);
  await seller.drain();
});

test("wait_for_result returns exact fixed-code submit result", async () => {
  const seller = executor();
  const result = await seller.notifyFunded({ job_id: 956, wait_for_result: true });
  assert.equal(result.ok, true);
  assert.equal(result.job_id, 956);
  assert.equal(result.tx_hash, TX);
  assert.equal(result.deliverable_url, URL);
});

test("wait_for_result rejects an unverified job before work", async () => {
  const seller = executor();
  const result = await seller.notifyFunded({ job_id: 955, wait_for_result: true });
  assert.equal(result.status, "rejected");
  assert.equal(result.job_id, 955);
  assert.equal(result.permanent, true);
});
