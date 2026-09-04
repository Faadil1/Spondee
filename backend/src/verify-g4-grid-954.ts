import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  hexToString,
  http,
  type Hex,
  type Log,
} from "viem";
import { DeliverableManifest } from "@bnbagent/sdk/erc8183";
import { BSC_TESTNET, validateLiveSpondeeReceipt } from "./erc8183.js";
import { TaskSchema } from "./contracts.js";

const CANONICAL_PROVIDER = getAddress("0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8");
const TARGET_BUYER = getAddress("0xaCFe38292DdFC028CD3D9e1900B590Ef8C99c3a1");
const TARGET_JOB_ID = 954n;
const TARGET_SUBMIT_TX = "0xf279d0f3b215ed6b92449fcaf93517a42f7c309190ab923aabd010d034a0e6f3" as Hex;
const EXPECTED_DELIVERABLE_URL = "http://127.0.0.1:9100/erc8183/job/954/response";
const EXPECTED_SCENARIO = "spondee-grid-live-001";
const TASK_PREFIX = "SPONDEE_TASK_B64_V1:";
const COMMITMENT_PREFIX = "SPONDEE_PROMISE_COMMITMENT_V1:";

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

type Commitment = { p: string; s: string; r: string; h: string };

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
  throw new Error(`${eventName}(${TARGET_JOB_ID}) not found in the known submit transaction receipt`);
}

function parseCommittedGridJob(description: string): {
  promiseId: string;
  promiseSha256: string;
  scenarioId: string;
} {
  const parsed = JSON.parse(description) as Record<string, unknown>;
  const taskCarrier = parsed.task;
  if (typeof taskCarrier !== "string" || !taskCarrier.startsWith(TASK_PREFIX)) {
    throw new Error("submitted Grid job description is missing SPONDEE_TASK_B64_V1 task carrier");
  }
  const task = TaskSchema.parse(
    JSON.parse(Buffer.from(taskCarrier.slice(TASK_PREFIX.length), "base64url").toString("utf8")),
  );
  if (task.schema !== "spondee.grid.task.v1") {
    throw new Error(`job 954 task schema is ${task.schema}, expected spondee.grid.task.v1`);
  }
  if (task.scenario_id !== EXPECTED_SCENARIO || task.evidence_class !== "SIMULATION") {
    throw new Error("job 954 Grid task does not match the authorized simulation scenario");
  }

  const terms = parsed.terms as Record<string, unknown> | undefined;
  const criteria = terms?.success_criteria;
  if (!Array.isArray(criteria)) throw new Error("submitted Grid job is missing success_criteria");
  const carriers = criteria.filter(
    (entry): entry is string => typeof entry === "string" && entry.startsWith(COMMITMENT_PREFIX),
  );
  if (carriers.length !== 1) {
    throw new Error(`job 954 must contain exactly one Spondee Promise commitment; found ${carriers.length}`);
  }
  const commitment = JSON.parse(carriers[0].slice(COMMITMENT_PREFIX.length)) as Commitment;
  if (
    typeof commitment.p !== "string" ||
    commitment.s !== EXPECTED_SCENARIO ||
    commitment.r !== "0" ||
    !/^[a-f0-9]{64}$/.test(commitment.h)
  ) {
    throw new Error("job 954 Promise commitment does not match the authorized zero-price Grid scenario");
  }
  return {
    promiseId: commitment.p,
    promiseSha256: commitment.h,
    scenarioId: commitment.s,
  };
}

export async function verifyGrid954Receipt() {
  const client = createPublicClient({ transport: http(BSC_TESTNET.rpc) });
  const receipt = await client.getTransactionReceipt({ hash: TARGET_SUBMIT_TX });
  if (receipt.status !== "success") throw new Error("known Grid provider submit transaction did not succeed");

  const submitted = findEvent(receipt.logs, BSC_TESTNET.commerce, jobSubmittedAbi, "JobSubmitted");
  if (getAddress(String(submitted.provider)) !== CANONICAL_PROVIDER) {
    throw new Error("Grid JobSubmitted provider does not match canonical Spondee seller");
  }

  const initialised = findEvent(receipt.logs, BSC_TESTNET.optimisticPolicy, jobInitialisedAbi, "JobInitialised");
  const submittedDeliverable = String(submitted.deliverable).toLowerCase();
  const initialisedDeliverable = String(initialised.deliverable).toLowerCase();
  if (submittedDeliverable !== initialisedDeliverable) {
    throw new Error("Grid JobSubmitted and JobInitialised deliverable hashes differ");
  }

  const optParams = JSON.parse(hexToString(initialised.optParams as Hex)) as { deliverable_url?: unknown };
  if (optParams.deliverable_url !== EXPECTED_DELIVERABLE_URL) {
    throw new Error(`unexpected Grid deliverable URL: ${String(optParams.deliverable_url ?? "missing")}`);
  }

  const job = (await client.readContract({
    address: BSC_TESTNET.commerce,
    abi: commerceGetJobAbi,
    functionName: "getJob",
    args: [TARGET_JOB_ID],
  })) as unknown as JobView;

  if (job.id !== TARGET_JOB_ID) throw new Error("getJob returned the wrong Grid job id");
  if (getAddress(job.client) !== TARGET_BUYER) throw new Error("job 954 client does not match the recorded ephemeral buyer");
  if (getAddress(job.provider) !== CANONICAL_PROVIDER) throw new Error("job 954 provider does not match canonical seller");
  if (Number(job.status) !== 2 && Number(job.status) !== 3) {
    throw new Error(`job 954 is not SUBMITTED/COMPLETED; status=${job.status}`);
  }
  if (job.budget !== 0n) throw new Error(`job 954 budget changed from zero: ${job.budget}`);
  if (job.deliverable.toLowerCase() !== submittedDeliverable) {
    throw new Error("job 954 getJob deliverable differs from the known submit receipt");
  }

  const commitment = parseCommittedGridJob(job.description);
  return { client, receipt, job, commitment, deliverableUrl: EXPECTED_DELIVERABLE_URL };
}

export async function verifyGrid954LocalManifestAndReceipt() {
  const chain = await verifyGrid954Receipt();
  const response = await fetch(chain.deliverableUrl, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Grid deliverable manifest HTTP ${response.status}`);
  const manifest = DeliverableManifest.fromDict((await response.json()) as Record<string, unknown>);
  if (!manifest.verify(chain.job.deliverable)) {
    throw new Error("Grid local manifest hash does not match the on-chain deliverable hash");
  }

  let content: unknown;
  try {
    content = JSON.parse(manifest.response.content);
  } catch {
    throw new Error("Grid manifest response.content is not valid JSON");
  }
  const verifiedReceipt = validateLiveSpondeeReceipt(
    content,
    chain.commitment.promiseId,
    chain.commitment.scenarioId,
  ) as Record<string, unknown>;
  if (verifiedReceipt.category !== "Grid Trading") {
    throw new Error(`Grid Outcome Receipt category mismatch: ${String(verifiedReceipt.category)}`);
  }
  if (verifiedReceipt.evidence_class !== "SIMULATION") {
    throw new Error("Grid Outcome Receipt attempted to cross the SIMULATION truth boundary");
  }

  return {
    schema: "spondee.g4-grid-job-954-verification.pass.v1",
    network: "bsc-testnet",
    chain_id: 97,
    category: "grid",
    provider_address: CANONICAL_PROVIDER,
    buyer_address: TARGET_BUYER,
    job_id: TARGET_JOB_ID.toString(),
    status: Number(chain.job.status) === 3 ? "COMPLETED" : "SUBMITTED",
    submit_transaction_hash: TARGET_SUBMIT_TX,
    submit_block: chain.receipt.blockNumber.toString(),
    submitted_at: chain.job.submittedAt.toString(),
    deliverable_url: chain.deliverableUrl,
    deliverable_hash: chain.job.deliverable,
    promise_id: chain.commitment.promiseId,
    promise_sha256: chain.commitment.promiseSha256,
    scenario_id: chain.commitment.scenarioId,
    manifest_hash_verified: true,
    spondee_receipt_verified: true,
    evidence_class: "SIMULATION",
    observed_agent_advantage_claimed: false,
    receipt_log_scan_used: false,
    secrets_printed: false,
    conclusion: "SPONDEE_G4_GRID_JOB_954_RECEIPT_VERIFICATION_PASS",
  } as const;
}
