import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { DeliverableManifest } from "@bnbagent/sdk/erc8183";
import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  hexToString,
  http,
  type Hex,
  type Log,
} from "viem";
import { BSC_TESTNET, validateLiveSpondeeReceipt } from "./erc8183.js";
import { TaskSchema } from "./contracts.js";
import { boundedNotifyFundedPayload, parseNotifyFundedSubmit } from "./category-erc8183.js";

const TARGET_JOB_ID = 955n;
const TARGET_BUYER = getAddress("0xbe9775807767c36A2ae4c2b88c1Fc08722273D37");
const TARGET_PROVIDER = getAddress("0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8");
const TARGET_SCENARIO = "spondee-rebalancing-live-001";
const TASK_PREFIX = "SPONDEE_TASK_B64_V1:";
const COMMITMENT_PREFIX = "SPONDEE_PROMISE_COMMITMENT_V1:";
const ZERO_DELIVERABLE = `0x${"0".repeat(64)}` as Hex;
const SUBMIT_WAIT_MS = 135_000;

const PRIOR_TRANSACTIONS = {
  create_job: "0x91be2b383238e90ed206859f8da57262331459dd8cf5a2c3db158d836d0c9615",
  register_job: "0xbaa83e00fc05b636401d1ffed6586d04a537cdd764c792c6cca5830b105facee",
  set_budget: "0x2aedd782b65ae6b531071e1c34da8b32f55c94570dcf47b58641778890467129",
  fund: "0xa82b4eababc631cc8af66dfa2f35fd88a04d53c7306f143314ca3ed470340e16",
} as const;

const commerceGetJobAbi = [
  {
    type: "function",
    name: "getJob",
    stateMutability: "view",
    inputs: [{ name: "jobId", type: "uint256" }],
    outputs: [
      {
        name: "job",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "client", type: "address" },
          { name: "provider", type: "address" },
          { name: "evaluator", type: "address" },
          { name: "description", type: "string" },
          { name: "budget", type: "uint256" },
          { name: "expiredAt", type: "uint64" },
          { name: "status", type: "uint8" },
          { name: "hook", type: "address" },
          { name: "submittedAt", type: "uint64" },
          { name: "deliverable", type: "bytes32" },
        ],
      },
    ],
  },
] as const;

const jobSubmittedAbi = [
  {
    anonymous: false,
    type: "event",
    name: "JobSubmitted",
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "deliverable", type: "bytes32" },
    ],
  },
] as const;

const jobInitialisedAbi = [
  {
    anonymous: false,
    type: "event",
    name: "JobInitialised",
    inputs: [
      { indexed: true, name: "jobId", type: "uint256" },
      { indexed: false, name: "deliverable", type: "bytes32" },
      { indexed: false, name: "submittedAt", type: "uint64" },
      { indexed: false, name: "optParams", type: "bytes" },
    ],
  },
] as const;

type JobView = {
  id: bigint;
  client: `0x${string}`;
  provider: `0x${string}`;
  evaluator: `0x${string}`;
  description: string;
  budget: bigint;
  expiredAt: bigint;
  status: number;
  hook: `0x${string}`;
  submittedAt: bigint;
  deliverable: Hex;
};

type RpcReply = {
  error?: { message?: string };
  result?: { parts?: Array<{ data?: Record<string, unknown> }> };
};

type Commitment = { p: string; s: string; r: string; h: string };

async function getJob(client: ReturnType<typeof createPublicClient>): Promise<JobView> {
  return (await client.readContract({
    address: BSC_TESTNET.commerce,
    abi: commerceGetJobAbi,
    functionName: "getJob",
    args: [TARGET_JOB_ID],
  })) as unknown as JobView;
}

function parseCommitment(description: string): {
  promiseId: string;
  promiseSha256: string;
  scenarioId: string;
} {
  const parsed = JSON.parse(description) as Record<string, unknown>;
  const carrier = parsed.task;
  if (typeof carrier !== "string" || !carrier.startsWith(TASK_PREFIX)) {
    throw new Error("job 955 is missing the Spondee task carrier");
  }
  const task = TaskSchema.parse(
    JSON.parse(Buffer.from(carrier.slice(TASK_PREFIX.length), "base64url").toString("utf8")),
  );
  if (task.schema !== "spondee.rebalancing.task.v1") {
    throw new Error(`job 955 task schema is ${task.schema}, expected rebalancing`);
  }
  if (task.scenario_id !== TARGET_SCENARIO || task.evidence_class !== "SIMULATION") {
    throw new Error("job 955 task does not match the authorized Rebalancing simulation scenario");
  }

  const terms = parsed.terms as Record<string, unknown> | undefined;
  const criteria = terms?.success_criteria;
  if (!Array.isArray(criteria)) throw new Error("job 955 is missing success_criteria");
  const carriers = criteria.filter(
    (entry): entry is string => typeof entry === "string" && entry.startsWith(COMMITMENT_PREFIX),
  );
  if (carriers.length !== 1) {
    throw new Error(`job 955 must contain exactly one Spondee Promise commitment; found ${carriers.length}`);
  }
  const commitment = JSON.parse(carriers[0].slice(COMMITMENT_PREFIX.length)) as Commitment;
  if (
    typeof commitment.p !== "string" ||
    commitment.s !== TARGET_SCENARIO ||
    commitment.r !== "0" ||
    !/^[a-f0-9]{64}$/.test(commitment.h)
  ) {
    throw new Error("job 955 Promise commitment does not match the authorized zero-price Rebalancing scenario");
  }
  return { promiseId: commitment.p, promiseSha256: commitment.h, scenarioId: commitment.s };
}

async function sendBoundedNotify(messageUrl: string): Promise<Record<string, unknown>> {
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
          messageId: randomUUID(),
          parts: [{ kind: "data", data: boundedNotifyFundedPayload(TARGET_JOB_ID) }],
        },
      },
    }),
    signal: AbortSignal.timeout(SUBMIT_WAIT_MS),
  });
  if (!response.ok) throw new Error(`seller A2A HTTP ${response.status}`);
  const reply = (await response.json()) as RpcReply;
  if (reply.error) throw new Error(`seller A2A error: ${reply.error.message ?? "unknown"}`);
  const data = reply.result?.parts?.[0]?.data;
  if (!data) throw new Error("seller A2A response contained no data part");
  return data;
}

function findEvent(
  logs: readonly Log[],
  address: string,
  abi: typeof jobSubmittedAbi | typeof jobInitialisedAbi,
  eventName: "JobSubmitted" | "JobInitialised",
): Record<string, unknown> {
  for (const log of logs) {
    if (log.address.toLowerCase() !== address.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi, eventName, data: log.data, topics: log.topics });
      const args = decoded.args as Record<string, unknown>;
      if (args.jobId === TARGET_JOB_ID) return args;
    } catch {
      // unrelated log from the same contract
    }
  }
  throw new Error(`${eventName}(955) not found in exact provider submit receipt`);
}

async function persistEvidence(result: Record<string, unknown>): Promise<void> {
  const path = process.env.SPONDEE_LIVE_EVIDENCE_PATH?.trim();
  if (!path) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const sellerUrl = process.env.SPONDEE_SELLER_A2A_URL?.trim();
  if (!sellerUrl) throw new Error("SPONDEE_SELLER_A2A_URL is required for job 955 recovery");

  const client = createPublicClient({ transport: http(BSC_TESTNET.rpc) });
  const before = await getJob(client);
  if (before.id !== TARGET_JOB_ID) throw new Error("getJob returned the wrong job id");
  if (getAddress(before.client) !== TARGET_BUYER) throw new Error("job 955 buyer mismatch");
  if (getAddress(before.provider) !== TARGET_PROVIDER) throw new Error("job 955 provider mismatch");
  if (before.budget !== 0n) throw new Error(`job 955 budget changed from zero: ${before.budget}`);
  if (Number(before.status) !== 1) {
    throw new Error(`job 955 recovery requires FUNDED status=1; current status=${before.status}. Do not resubmit blindly.`);
  }
  if (before.deliverable.toLowerCase() !== ZERO_DELIVERABLE.toLowerCase()) {
    throw new Error("job 955 already has a deliverable; refuse recovery write");
  }
  const commitment = parseCommitment(before.description);
  const buyerBalanceBefore = await client.getBalance({ address: TARGET_BUYER });
  if (buyerBalanceBefore !== 0n) throw new Error(`job 955 buyer balance is not zero before recovery: ${buyerBalanceBefore}`);

  const boundedResult = await sendBoundedNotify(sellerUrl);
  const submit = parseNotifyFundedSubmit(boundedResult, TARGET_JOB_ID);
  const receipt = await client.getTransactionReceipt({ hash: submit.transactionHash });
  if (receipt.status !== "success") throw new Error("provider submit transaction did not succeed");

  const submitted = findEvent(receipt.logs, BSC_TESTNET.commerce, jobSubmittedAbi, "JobSubmitted");
  if (getAddress(String(submitted.provider)) !== TARGET_PROVIDER) {
    throw new Error("JobSubmitted provider does not match canonical seller");
  }
  const initialised = findEvent(receipt.logs, BSC_TESTNET.optimisticPolicy, jobInitialisedAbi, "JobInitialised");
  const submittedDeliverable = String(submitted.deliverable).toLowerCase();
  const initialisedDeliverable = String(initialised.deliverable).toLowerCase();
  if (submittedDeliverable !== initialisedDeliverable) {
    throw new Error("JobSubmitted and JobInitialised deliverable hashes differ");
  }
  const optParams = JSON.parse(hexToString(initialised.optParams as Hex)) as { deliverable_url?: unknown };
  if (typeof optParams.deliverable_url !== "string" || optParams.deliverable_url.length === 0) {
    throw new Error("JobInitialised is missing deliverable_url");
  }
  const deliverableUrl = optParams.deliverable_url;
  if (submit.deliverableUrl !== null && submit.deliverableUrl !== deliverableUrl) {
    throw new Error("seller terminal result deliverable_url differs from exact submit receipt");
  }

  const after = await getJob(client);
  if (Number(after.status) !== 2 && Number(after.status) !== 3) {
    throw new Error(`job 955 did not become SUBMITTED/COMPLETED; status=${after.status}`);
  }
  if (after.deliverable.toLowerCase() !== submittedDeliverable) {
    throw new Error("getJob deliverable differs from exact submit receipt");
  }

  const manifestResponse = await fetch(deliverableUrl, { signal: AbortSignal.timeout(15_000) });
  if (!manifestResponse.ok) throw new Error(`Rebalancing deliverable manifest HTTP ${manifestResponse.status}`);
  const manifest = DeliverableManifest.fromDict((await manifestResponse.json()) as Record<string, unknown>);
  if (!manifest.verify(after.deliverable)) {
    throw new Error("Rebalancing manifest hash does not match on-chain deliverable hash");
  }
  let content: unknown;
  try {
    content = JSON.parse(manifest.response.content);
  } catch {
    throw new Error("Rebalancing manifest response.content is not valid JSON");
  }
  const verifiedReceipt = validateLiveSpondeeReceipt(content, commitment.promiseId, commitment.scenarioId) as Record<string, unknown>;
  if (verifiedReceipt.category !== "Rebalancing") {
    throw new Error(`Rebalancing Outcome Receipt category mismatch: ${String(verifiedReceipt.category)}`);
  }
  if (verifiedReceipt.evidence_class !== "SIMULATION") {
    throw new Error("Rebalancing Outcome Receipt crossed the SIMULATION truth boundary");
  }

  const buyerBalanceAfter = await client.getBalance({ address: TARGET_BUYER });
  if (buyerBalanceAfter !== 0n) throw new Error(`job 955 buyer balance changed from zero: ${buyerBalanceAfter}`);

  const result = {
    schema: "spondee.g4-rebalancing-job-955-recovery.pass.v1",
    network: "bsc-testnet",
    chain_id: 97,
    category: "rebalancing",
    provider_address: TARGET_PROVIDER,
    buyer_address: TARGET_BUYER,
    buyer_balance_before_wei: buyerBalanceBefore.toString(),
    buyer_balance_after_wei: buyerBalanceAfter.toString(),
    job_id: "955",
    status: Number(after.status) === 3 ? "COMPLETED" : "SUBMITTED",
    task_schema: "spondee.rebalancing.task.v1",
    scenario_id: TARGET_SCENARIO,
    price_raw: "0",
    promise_id: commitment.promiseId,
    promise_sha256: commitment.promiseSha256,
    transactions: {
      ...PRIOR_TRANSACTIONS,
      submit: submit.transactionHash,
    },
    submit_block: receipt.blockNumber.toString(),
    submitted_at: after.submittedAt.toString(),
    deliverable_url: deliverableUrl,
    deliverable_hash: after.deliverable,
    manifest_hash_verified: true,
    spondee_receipt_verified: true,
    evidence_class: "SIMULATION",
    observed_agent_advantage_claimed: false,
    historical_log_scan_used: false,
    new_job_created_during_recovery: false,
    secrets_printed: false,
    conclusion: "SPONDEE_G4_REBALANCING_JOB_955_RECOVERY_PASS",
  } as const;

  await persistEvidence(result as unknown as Record<string, unknown>);
  console.log(JSON.stringify(result, null, 2));
  console.log("SPONDEE G4 REBALANCING JOB 955 RECOVERY: PASS");
}

main().catch(async (error: unknown) => {
  const failure = {
    schema: "spondee.g4-rebalancing-job-955-recovery.failure.v1",
    network: "bsc-testnet",
    chain_id: 97,
    category: "rebalancing",
    provider_address: TARGET_PROVIDER,
    buyer_address: TARGET_BUYER,
    job_id: "955",
    error: error instanceof Error ? error.message : String(error),
    new_job_created_during_recovery: false,
    observed_agent_advantage_claimed: false,
    secrets_printed: false,
    conclusion: "SPONDEE_G4_REBALANCING_JOB_955_RECOVERY_FAIL_CLOSED",
  };
  try { await persistEvidence(failure); } catch { /* evidence write must not mask root failure */ }
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
});
