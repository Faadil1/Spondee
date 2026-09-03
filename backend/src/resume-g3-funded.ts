import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  DeliverableManifest,
  ERC8183Client,
  JobDescription,
  JobStatus,
} from "@bnbagent/sdk/erc8183";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { getAddress } from "viem";
import type { SpondeeTask } from "./contracts.js";
import {
  BSC_TESTNET,
  validateLiveSpondeeReceipt,
} from "./erc8183.js";

const EXPECTED_PROVIDER = getAddress(
  process.env.SPONDEE_PROVIDER_ADDRESS ??
    "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8",
);
const COMMITMENT_PREFIX = "SPONDEE_PROMISE_COMMITMENT_V1:";
const TASK_PREFIX = "SPONDEE_TASK_B64_V1:";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function decodeCommitment(successCriteria: unknown) {
  assert(Array.isArray(successCriteria), "job success_criteria is missing");
  const matches = successCriteria.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith(COMMITMENT_PREFIX),
  );
  assert(matches.length === 1, `expected exactly one Spondee commitment, found ${matches.length}`);
  const raw = JSON.parse(matches[0].slice(COMMITMENT_PREFIX.length)) as unknown;
  const value = objectOrNull(raw);
  assert(value, "Spondee commitment is not an object");
  assert(typeof value.p === "string" && value.p.length > 0, "commitment promise id missing");
  assert(typeof value.s === "string" && value.s.length > 0, "commitment scenario id missing");
  assert(value.r === "0", "G3 recovery refuses a non-zero committed price");
  assert(typeof value.h === "string" && /^[a-f0-9]{64}$/.test(value.h), "commitment hash invalid");
  return {
    promise_id: value.p,
    scenario_id: value.s,
    price_raw: value.r,
    promise_sha256: value.h,
  };
}

function decodeTask(encoded: unknown): SpondeeTask {
  assert(typeof encoded === "string" && encoded.startsWith(TASK_PREFIX), "job task is not the Spondee Base64URL carrier");
  const raw = Buffer.from(encoded.slice(TASK_PREFIX.length), "base64url").toString("utf8");
  const task = JSON.parse(raw) as SpondeeTask;
  assert(task.schema === "spondee.health-factor.task.v1", "recovered job is not a Health Factor task");
  return task;
}

async function sendSkill(messageUrl: string, data: Record<string, unknown>) {
  const response = await fetch(messageUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "message/send",
      params: {
        message: {
          kind: "message",
          role: "user",
          messageId: `resume-${Date.now()}`,
          parts: [{ kind: "data", data }],
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  assert(response.ok, `seller A2A HTTP ${response.status}`);
  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: { parts?: Array<{ data?: Record<string, unknown> }> };
  };
  assert(!payload.error, `seller A2A error: ${payload.error?.message ?? "unknown"}`);
  return payload.result?.parts?.[0]?.data ?? null;
}

async function fetchManifest(url: string): Promise<DeliverableManifest> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  assert(response.ok, `deliverable manifest HTTP ${response.status}`);
  const parsed = JSON.parse(await response.text()) as Record<string, unknown>;
  return DeliverableManifest.fromDict(parsed);
}

async function main() {
  assert(process.env.SPONDEE_LIVE_TESTNET_ENABLED === "true", "SPONDEE_LIVE_TESTNET_ENABLED=true is required");
  const jobIdRaw = process.env.SPONDEE_G3_RESUME_JOB_ID?.trim() ?? "";
  assert(/^\d+$/.test(jobIdRaw), "SPONDEE_G3_RESUME_JOB_ID must be a numeric funded job id");
  const jobId = BigInt(jobIdRaw);
  const sellerUrl = process.env.SPONDEE_SELLER_A2A_URL?.trim() ?? "";
  assert(sellerUrl.length > 0, "SPONDEE_SELLER_A2A_URL is required");

  const taskPath = resolve(
    process.env.SPONDEE_G3_TASK_PATH ??
      "../reference-agents/health-factor/demo/health-factor-scenario.json",
  );
  const canonicalTask = JSON.parse(await readFile(taskPath, "utf8")) as SpondeeTask;
  assert(canonicalTask.schema === "spondee.health-factor.task.v1", "canonical Health Factor task is invalid");

  const tempWalletDir = await mkdtemp(join(tmpdir(), "spondee-g3-resume-reader-"));
  const password = `${randomBytes(32).toString("hex")}Aa1!`;
  const wallet = new EVMWalletProvider({ password, walletsDir: tempWalletDir, persist: true });
  const publicEvidencePath = process.env.SPONDEE_LIVE_EVIDENCE_PATH?.trim() || null;
  const startedAt = new Date().toISOString();

  try {
    const client = await ERC8183Client.create({ walletProvider: wallet, network: "bsc-testnet" });
    const before = await client.getJob(jobId);
    assert(getAddress(before.provider) === EXPECTED_PROVIDER, "funded job provider does not match canonical Spondee seller");
    assert(
      before.status === JobStatus.FUNDED ||
        before.status === JobStatus.SUBMITTED ||
        before.status === JobStatus.COMPLETED,
      `job ${jobIdRaw} is not recoverable from status ${String(before.status)}`,
    );

    const spec = JobDescription.fromStr(before.description);
    assert(spec !== null, "funded job description is not structured");
    const recoveredTask = decodeTask(spec.task);
    assert(
      JSON.stringify(recoveredTask) === JSON.stringify(canonicalTask),
      "funded job task does not match the canonical G3 Health Factor task",
    );
    const terms = objectOrNull(spec.terms);
    assert(terms, "funded job terms are missing");
    const commitment = decodeCommitment(terms.success_criteria);
    assert(commitment.scenario_id === canonicalTask.scenario_id, "commitment scenario does not match canonical task");

    if (before.status === JobStatus.FUNDED) {
      const ack = await sendSkill(sellerUrl, { skill: "notify_funded", job_id: Number(jobId) });
      assert(ack !== null, "seller notify_funded returned no data");
    }

    const deadline = Date.now() + 120_000;
    let finalJob = before;
    while (Date.now() < deadline) {
      finalJob = await client.getJob(jobId);
      if (finalJob.status === JobStatus.SUBMITTED || finalJob.status === JobStatus.COMPLETED) break;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
    }
    assert(
      finalJob.status === JobStatus.SUBMITTED || finalJob.status === JobStatus.COMPLETED,
      `timed out waiting for recovered job ${jobIdRaw} to reach SUBMITTED`,
    );

    const deliverableUrl = await client.getDeliverableUrl(jobId);
    assert(deliverableUrl, "recovered submitted job has no deliverable URL");
    const manifest = await fetchManifest(deliverableUrl);
    assert(manifest.verify(finalJob.deliverable), "deliverable manifest hash does not match on-chain job hash");

    let receiptRaw: unknown;
    try {
      receiptRaw = JSON.parse(manifest.response.content);
    } catch {
      throw new Error("deliverable manifest response.content is not valid JSON");
    }
    const receipt = validateLiveSpondeeReceipt(
      receiptRaw,
      commitment.promise_id,
      commitment.scenario_id,
    );

    const latestBlock = await client.publicClient.getBlockNumber();
    const fromBlock = latestBlock > 1500n ? latestBlock - 1500n : 0n;
    const events = await client.commerce.getJobSubmittedEvents(fromBlock, latestBlock, jobId);
    const submitEvent = events.at(-1) ?? null;

    const evidence = {
      schema: "spondee.g3-funded-job-recovery.v1",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      network: "bsc-testnet",
      chain_id: BSC_TESTNET.chainId,
      provider_address: EXPECTED_PROVIDER,
      job_id: jobIdRaw,
      initial_status: String(before.status),
      final_status: finalJob.status === JobStatus.COMPLETED ? "COMPLETED" : "SUBMITTED",
      recovery_mode: "EXISTING_FUNDED_JOB_NO_NEW_CREATE_REGISTER_BUDGET_FUND",
      submit_transaction_hash: submitEvent?.transactionHash ?? null,
      deliverable_url: deliverableUrl,
      promise_id: commitment.promise_id,
      promise_sha256: commitment.promise_sha256,
      scenario_id: commitment.scenario_id,
      service_price_raw: commitment.price_raw,
      manifest_hash_verified: true,
      spondee_receipt_verified: true,
      receipt,
      secrets_printed: false,
      conclusion: "SPONDEE_G3_FUNDED_JOB_RECOVERY_PASS",
    };
    const json = JSON.stringify(evidence, null, 2);
    if (publicEvidencePath) await writeFile(publicEvidencePath, `${json}\n`, "utf8");
    console.log(json);
  } catch (error) {
    const failure = {
      schema: "spondee.g3-funded-job-recovery.failure.v1",
      started_at: startedAt,
      failed_at: new Date().toISOString(),
      network: "bsc-testnet",
      chain_id: 97,
      provider_address: EXPECTED_PROVIDER,
      job_id: jobIdRaw,
      error: error instanceof Error ? error.message : String(error),
      secrets_printed: false,
      conclusion: "SPONDEE_G3_FUNDED_JOB_RECOVERY_FAIL_CLOSED",
    };
    const json = JSON.stringify(failure, null, 2);
    if (publicEvidencePath) await writeFile(publicEvidencePath, `${json}\n`, "utf8");
    console.error(json);
    process.exitCode = 1;
  } finally {
    wallet.destroy();
    await rm(tempWalletDir, { recursive: true, force: true });
  }
}

await main();
