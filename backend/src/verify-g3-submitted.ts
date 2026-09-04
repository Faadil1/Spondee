import {
  decodeEventLog,
  getAddress,
  hexToString,
  createPublicClient,
  http,
  type Hex,
  type Log,
} from "viem";
import { DeliverableManifest } from "@bnbagent/sdk/erc8183";
import { BSC_TESTNET, validateLiveSpondeeReceipt } from "./erc8183.js";

const CANONICAL_PROVIDER = getAddress("0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8");
const TARGET_JOB_ID = 949n;
const TARGET_SUBMIT_TX = "0x39243a3e3b145e31cd6318ace98ca764028a91e1a68d5f89f7fdc556d4b4fc74" as Hex;
const EXPECTED_DELIVERABLE_URL = "http://127.0.0.1:9100/erc8183/job/949/response";
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

type Commitment = {
  p: string;
  s: string;
  r: string;
  h: string;
};

function findReceiptEvent(
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

function parseCommittedJobDescription(description: string): {
  promiseId: string;
  scenarioId: string;
  promiseSha256: string;
} {
  const parsed = JSON.parse(description) as Record<string, unknown>;
  const taskCarrier = parsed.task;
  if (typeof taskCarrier !== "string" || !taskCarrier.startsWith(TASK_PREFIX)) {
    throw new Error("submitted job description is missing SPONDEE_TASK_B64_V1 task carrier");
  }
  const task = JSON.parse(
    Buffer.from(taskCarrier.slice(TASK_PREFIX.length), "base64url").toString("utf8"),
  ) as Record<string, unknown>;
  if (task.schema !== "spondee.health-factor.task.v1" || typeof task.scenario_id !== "string") {
    throw new Error("submitted job task is not the canonical Health Factor task");
  }

  const terms = parsed.terms as Record<string, unknown> | undefined;
  const criteria = terms?.success_criteria;
  if (!Array.isArray(criteria)) {
    throw new Error("submitted job description is missing success_criteria");
  }
  const carriers = criteria.filter(
    (entry): entry is string => typeof entry === "string" && entry.startsWith(COMMITMENT_PREFIX),
  );
  if (carriers.length !== 1) {
    throw new Error(`submitted job must contain exactly one Spondee Promise commitment; found ${carriers.length}`);
  }
  const commitment = JSON.parse(carriers[0].slice(COMMITMENT_PREFIX.length)) as Commitment;
  if (
    typeof commitment.p !== "string" ||
    commitment.s !== task.scenario_id ||
    commitment.r !== "0" ||
    !/^[a-f0-9]{64}$/.test(commitment.h)
  ) {
    throw new Error("submitted job Promise commitment does not match the canonical zero-price Health Factor task");
  }
  return {
    promiseId: commitment.p,
    scenarioId: commitment.s,
    promiseSha256: commitment.h,
  };
}

export async function verifySubmittedJob949() {
  const client = createPublicClient({ transport: http(BSC_TESTNET.rpc) });
  const receipt = await client.getTransactionReceipt({ hash: TARGET_SUBMIT_TX });
  if (receipt.status !== "success") {
    throw new Error("known provider submit transaction did not succeed");
  }

  const submitted = findReceiptEvent(
    receipt.logs,
    BSC_TESTNET.commerce,
    jobSubmittedAbi,
    "JobSubmitted",
  );
  if (getAddress(String(submitted.provider)) !== CANONICAL_PROVIDER) {
    throw new Error("JobSubmitted provider does not match canonical Spondee seller");
  }

  const initialised = findReceiptEvent(
    receipt.logs,
    BSC_TESTNET.optimisticPolicy,
    jobInitialisedAbi,
    "JobInitialised",
  );
  const submittedDeliverable = String(submitted.deliverable).toLowerCase();
  const initialisedDeliverable = String(initialised.deliverable).toLowerCase();
  if (submittedDeliverable !== initialisedDeliverable) {
    throw new Error("JobSubmitted and JobInitialised deliverable hashes differ");
  }

  const rawOptParams = initialised.optParams as Hex;
  const optParams = JSON.parse(hexToString(rawOptParams)) as { deliverable_url?: string };
  if (optParams.deliverable_url !== EXPECTED_DELIVERABLE_URL) {
    throw new Error(`unexpected on-chain deliverable URL: ${optParams.deliverable_url ?? "missing"}`);
  }

  const job = (await client.readContract({
    address: BSC_TESTNET.commerce,
    abi: commerceGetJobAbi,
    functionName: "getJob",
    args: [TARGET_JOB_ID],
  })) as unknown as JobView;

  if (job.id !== TARGET_JOB_ID) throw new Error("getJob returned the wrong job id");
  if (getAddress(job.provider) !== CANONICAL_PROVIDER) {
    throw new Error("on-chain job provider does not match canonical Spondee seller");
  }
  if (Number(job.status) !== 2 && Number(job.status) !== 3) {
    throw new Error(`job 949 is not SUBMITTED/COMPLETED; status=${job.status}`);
  }
  if (job.deliverable.toLowerCase() !== submittedDeliverable) {
    throw new Error("on-chain getJob deliverable hash differs from submit receipt");
  }

  const commitment = parseCommittedJobDescription(job.description);

  const response = await fetch(EXPECTED_DELIVERABLE_URL, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`deliverable manifest HTTP ${response.status}`);
  const manifestDict = (await response.json()) as Record<string, unknown>;
  const manifest = DeliverableManifest.fromDict(manifestDict);
  if (!manifest.verify(job.deliverable)) {
    throw new Error("deliverable manifest hash does not match the on-chain job deliverable hash");
  }

  let receiptContent: unknown;
  try {
    receiptContent = JSON.parse(manifest.response.content);
  } catch {
    throw new Error("deliverable manifest response.content is not valid JSON");
  }
  const verifiedReceipt = validateLiveSpondeeReceipt(
    receiptContent,
    commitment.promiseId,
    commitment.scenarioId,
  );

  return {
    schema: "spondee.g3-submitted-job-verification.pass.v1",
    network: "bsc-testnet",
    chain_id: 97,
    provider_address: CANONICAL_PROVIDER,
    job_id: TARGET_JOB_ID.toString(),
    status: Number(job.status) === 3 ? "COMPLETED" : "SUBMITTED",
    submit_transaction_hash: TARGET_SUBMIT_TX,
    submit_block: receipt.blockNumber.toString(),
    submitted_at: job.submittedAt.toString(),
    deliverable_url: EXPECTED_DELIVERABLE_URL,
    deliverable_hash: job.deliverable,
    promise_id: commitment.promiseId,
    promise_sha256: commitment.promiseSha256,
    scenario_id: commitment.scenarioId,
    manifest_hash_verified: true,
    spondee_receipt_verified: true,
    evidence_class: verifiedReceipt.evidence_class,
    observed_agent_advantage_claimed: false,
    secrets_printed: false,
    conclusion: "SPONDEE_G3_SUBMITTED_JOB_949_RECEIPT_VERIFICATION_PASS",
  } as const;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  verifySubmittedJob949()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("SPONDEE G3 SUBMITTED JOB 949 VERIFICATION: PASS");
    })
    .catch((error) => {
      const failure = {
        schema: "spondee.g3-submitted-job-verification.failure.v1",
        network: "bsc-testnet",
        chain_id: 97,
        provider_address: CANONICAL_PROVIDER,
        job_id: TARGET_JOB_ID.toString(),
        submit_transaction_hash: TARGET_SUBMIT_TX,
        error: error instanceof Error ? error.message : String(error),
        secrets_printed: false,
        conclusion: "SPONDEE_G3_SUBMITTED_JOB_949_RECEIPT_VERIFICATION_FAIL_CLOSED",
      };
      console.error(JSON.stringify(failure, null, 2));
      process.exitCode = 1;
    });
}
