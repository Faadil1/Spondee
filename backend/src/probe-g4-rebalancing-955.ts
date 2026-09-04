import { createPublicClient, getAddress, http } from "viem";
import { BSC_TESTNET } from "./erc8183.js";
import { TaskSchema } from "./contracts.js";

const TARGET_JOB_ID = 955n;
const TARGET_BUYER = getAddress("0xbe9775807767c36A2ae4c2b88c1Fc08722273D37");
const TARGET_PROVIDER = getAddress("0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8");
const TARGET_SCENARIO = "spondee-rebalancing-live-001";
const TASK_PREFIX = "SPONDEE_TASK_B64_V1:";

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
  deliverable: `0x${string}`;
};

function statusName(status: number): string {
  if (status === 0) return "OPEN";
  if (status === 1) return "FUNDED";
  if (status === 2) return "SUBMITTED";
  if (status === 3) return "COMPLETED";
  return `UNKNOWN_${status}`;
}

function parseTask(description: string) {
  const parsed = JSON.parse(description) as Record<string, unknown>;
  const carrier = parsed.task;
  if (typeof carrier !== "string" || !carrier.startsWith(TASK_PREFIX)) {
    throw new Error("job 955 is missing the Spondee task carrier");
  }
  return TaskSchema.parse(
    JSON.parse(Buffer.from(carrier.slice(TASK_PREFIX.length), "base64url").toString("utf8")),
  );
}

async function main(): Promise<void> {
  const client = createPublicClient({ transport: http(BSC_TESTNET.rpc) });
  const job = (await client.readContract({
    address: BSC_TESTNET.commerce,
    abi: commerceGetJobAbi,
    functionName: "getJob",
    args: [TARGET_JOB_ID],
  })) as unknown as JobView;

  if (job.id !== TARGET_JOB_ID) throw new Error(`getJob returned job ${job.id}, expected 955`);
  if (getAddress(job.client) !== TARGET_BUYER) throw new Error("job 955 buyer mismatch");
  if (getAddress(job.provider) !== TARGET_PROVIDER) throw new Error("job 955 provider mismatch");
  if (job.budget !== 0n) throw new Error(`job 955 budget changed from zero: ${job.budget}`);

  const task = parseTask(job.description);
  if (task.schema !== "spondee.rebalancing.task.v1") {
    throw new Error(`job 955 task schema is ${task.schema}, expected rebalancing`);
  }
  if (task.scenario_id !== TARGET_SCENARIO || task.evidence_class !== "SIMULATION") {
    throw new Error("job 955 task does not match the authorized Rebalancing simulation scenario");
  }

  const status = Number(job.status);
  const buyerBalance = await client.getBalance({ address: TARGET_BUYER });

  console.log(JSON.stringify({
    schema: "spondee.g4-rebalancing-job-955-read-only-status.v1",
    network: "bsc-testnet",
    chain_id: 97,
    category: "rebalancing",
    provider_address: TARGET_PROVIDER,
    buyer_address: TARGET_BUYER,
    buyer_balance_wei: buyerBalance.toString(),
    job_id: "955",
    status_code: status,
    status: statusName(status),
    submitted_at: job.submittedAt.toString(),
    deliverable_hash: job.deliverable,
    budget_raw: job.budget.toString(),
    task_schema: task.schema,
    scenario_id: task.scenario_id,
    evidence_class: task.evidence_class,
    chain_write_attempted: false,
    wallet_used: false,
    secrets_printed: false,
    conclusion: `SPONDEE_G4_REBALANCING_JOB_955_READ_ONLY_${statusName(status)}_PROBE_PASS`,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
