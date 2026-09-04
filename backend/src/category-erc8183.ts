import { randomUUID } from "node:crypto";
import {
  DeliverableManifest,
  ERC8183Client,
  JobStatus,
  buildJobDescription,
  verifyQuoteSignature,
} from "@bnbagent/sdk/erc8183";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { decodeEventLog, getAddress, hexToString, type Hex, type Log } from "viem";
import type { SpondeeTask } from "./contracts.js";
import {
  BSC_TESTNET,
  SPONDEE_G3_SUBMISSION_WINDOW_SECONDS,
  SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES,
  liveGateStatus,
  signedSpondeePromiseCommitmentFromQuote,
  validateLiveSpondeeReceipt,
  validatePreviewPromise,
  validatePromiseAgainstCommitment,
  validateSignedQuoteEnvelope,
  type LiveActivationProgress,
} from "./erc8183.js";

const TASK_PREFIX = "SPONDEE_TASK_B64_V1:";
const DEFAULT_PROVIDER = "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8";

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

interface RpcReply {
  error?: { message?: string };
  result?: { parts?: Array<{ data?: Record<string, unknown> }> };
}

export const LIVE_CATEGORY_TASK_SCHEMAS = new Set([
  "spondee.health-factor.task.v1",
  "spondee.grid.task.v1",
  "spondee.rebalancing.task.v1",
  "spondee.yield.task.v1",
]);

export function supportsSpondeeLiveTask(task: SpondeeTask): boolean {
  return LIVE_CATEGORY_TASK_SCHEMAS.has(task.schema);
}

export function encodeSpondeeCategoryTask(task: SpondeeTask): string {
  if (!supportsSpondeeLiveTask(task)) {
    throw new Error(`unsupported Spondee live task schema: ${(task as { schema?: unknown }).schema ?? "missing"}`);
  }
  return `${TASK_PREFIX}${Buffer.from(JSON.stringify(task), "utf8").toString("base64url")}`;
}

async function sendSkill(
  messageUrl: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
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
          parts: [{ kind: "data", data }],
        },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`seller A2A HTTP ${response.status}`);
  const reply = (await response.json()) as RpcReply;
  if (reply.error) throw new Error(`seller A2A error: ${reply.error.message ?? "unknown"}`);
  const dataPart = reply.result?.parts?.[0]?.data;
  if (!dataPart) throw new Error("seller A2A response contained no data part");
  return dataPart;
}

function decodeDeliverableUrlFromKnownSubmitReceipt(
  logs: readonly Log[],
  jobId: bigint,
  expectedDeliverable: Hex,
): string {
  for (const log of logs) {
    if (log.address.toLowerCase() !== BSC_TESTNET.optimisticPolicy.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: jobInitialisedAbi,
        eventName: "JobInitialised",
        data: log.data,
        topics: log.topics,
      });
      const args = decoded.args as {
        jobId: bigint;
        deliverable: Hex;
        submittedAt: bigint;
        optParams: Hex;
      };
      if (args.jobId !== jobId) continue;
      if (args.deliverable.toLowerCase() !== expectedDeliverable.toLowerCase()) {
        throw new Error("JobInitialised deliverable differs from on-chain getJob deliverable");
      }
      const params = JSON.parse(hexToString(args.optParams)) as { deliverable_url?: unknown };
      if (typeof params.deliverable_url !== "string" || params.deliverable_url.length === 0) {
        throw new Error("JobInitialised optParams is missing deliverable_url");
      }
      return params.deliverable_url;
    } catch (error) {
      if (error instanceof Error && error.message.includes("deliverable")) throw error;
    }
  }
  throw new Error(`JobInitialised(${jobId}) not found in the known provider submit receipt`);
}

async function fetchManifest(deliverableUrl: string, gatewayUrl: string): Promise<DeliverableManifest> {
  const url = deliverableUrl.startsWith("ipfs://")
    ? `${gatewayUrl.replace(/\/+$/, "")}/${deliverableUrl.slice("ipfs://".length)}`
    : deliverableUrl;
  if (url.startsWith("file://")) {
    throw new Error("multi-category live path refuses file:// deliverables; configure ERC8183_AGENT_URL or durable public storage");
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`deliverable manifest HTTP ${response.status}`);
  return DeliverableManifest.fromDict((await response.json()) as Record<string, unknown>);
}

export interface CategoryLiveTestnetResult {
  network: "bsc-testnet";
  provider_address: string;
  buyer_address: string;
  job_id: string;
  status: "SUBMITTED" | "COMPLETED";
  task_schema: string;
  price_raw: "0";
  promise_id: string;
  promise_sha256: string;
  job_description_bytes: number;
  transactions: {
    create_job: string;
    register_job: string;
    set_budget: string;
    fund: string;
    submit: string;
  };
  deliverable: {
    url: string;
    manifest_hash_verified: true;
    spondee_receipt_verified: true;
    receipt: Record<string, unknown>;
  };
}

type ProgressSink = (progress: LiveActivationProgress) => Promise<void> | void;

/**
 * Multi-category equivalent of the proven Health Factor G3 path.
 *
 * This function remains hard-gated by the same environment contract as G3 and is
 * never called by CI. It accepts all four Spondee task schemas, keeps the service
 * price at zero, verifies the signed Promise commitment before createJob, and
 * obtains the deliverable URL directly from the known provider submit receipt
 * rather than relying on a historical JobInitialised eth_getLogs scan.
 */
export async function runSignedZeroPriceCategoryTestnetActivation(
  task: SpondeeTask,
  env = process.env,
  onProgress: ProgressSink = () => undefined,
): Promise<CategoryLiveTestnetResult> {
  if (!supportsSpondeeLiveTask(task)) throw new Error(`unsupported Spondee live task schema: ${task.schema}`);

  const gate = liveGateStatus(env);
  if (!gate.ready_for_live_write) {
    throw new Error(
      "Live testnet gate is closed. Require SPONDEE_LIVE_TESTNET_ENABLED=true plus seller URL and local buyer keystore configuration.",
    );
  }

  const messageUrl = env.SPONDEE_SELLER_A2A_URL!;
  const expectedProvider = getAddress(env.SPONDEE_PROVIDER_ADDRESS ?? DEFAULT_PROVIDER);
  const buyerAddress = getAddress(env.BUYER_WALLET_ADDRESS!);
  const wallet = new EVMWalletProvider({
    password: env.BUYER_WALLET_PASSWORD!,
    address: buyerAddress,
    walletsDir: env.BUYER_WALLETS_DIR!,
    persist: true,
  });

  try {
    const taskDescription = encodeSpondeeCategoryTask(task);

    // The cloned G3 seller transport intentionally retains this legacy skill id;
    // the Agent Card label/schema is category-aware. Refactor the wire id only at
    // a later compatibility gate, not during bounded live proof.
    const previewRaw = await sendSkill(messageUrl, {
      skill: "preview_health_factor",
      task_description: taskDescription,
    });
    if (previewRaw.status !== "ok") throw new Error("seller rejected the read-only Spondee Promise preview");
    const previewPromise = validatePreviewPromise(previewRaw.promise, task.scenario_id);

    const quoteRaw = await sendSkill(messageUrl, {
      skill: "negotiate",
      task_description: taskDescription,
      terms: {
        deliverables: "Spondee Outcome Receipt",
        quality_standards: "Committed Spondee Promise; SIMULATION only",
      },
    });
    const quote = validateSignedQuoteEnvelope(quoteRaw);
    if (quote.response.terms.price !== "0") {
      throw new Error(`Spondee live activation refuses non-zero service price: ${quote.response.terms.price}`);
    }

    const client = await ERC8183Client.create({ walletProvider: wallet, network: "bsc-testnet" });
    const signedCurrency = quote.response.terms.currency;
    if (typeof signedCurrency !== "string") throw new Error("quote missing signed currency");
    const paymentToken = await client.paymentToken();
    if (getAddress(signedCurrency) !== getAddress(paymentToken)) {
      throw new Error("quote currency does not match the current Commerce payment token");
    }

    const verdict = await verifyQuoteSignature({
      envelope: quote,
      provider: expectedProvider,
      publicClient: client.publicClient,
      expectedVerifyingContract: client.commerce.address,
    });
    if (!verdict.valid) throw new Error(`provider quote rejected: ${verdict.reason}`);
    if (quote.request.task_description !== taskDescription) {
      throw new Error("signed task description does not match the encoded Spondee task");
    }

    const commitment = signedSpondeePromiseCommitmentFromQuote(quote);
    if (commitment.scenario_id !== task.scenario_id) {
      throw new Error("signed Promise commitment scenario does not match the live activation task");
    }
    if (commitment.price_raw !== "0") throw new Error("signed Promise commitment is not zero-price");
    validatePromiseAgainstCommitment(previewPromise, commitment);

    const description = buildJobDescription(quote, SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES);
    const descriptionBytes = Buffer.byteLength(description, "utf8");
    if (descriptionBytes > SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES) {
      throw new Error(`Spondee MegaFuel description budget exceeded: ${descriptionBytes} bytes`);
    }

    const disputeWindow = await client.policy.disputeWindow();
    const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + disputeWindow + SPONDEE_G3_SUBMISSION_WINDOW_SECONDS;

    const created = await client.createJob({ provider: expectedProvider, expiredAt, description });
    if (created.jobId === null) throw new Error("createJob did not return jobId");
    const jobId = created.jobId;
    await onProgress({ stage: "CREATE_JOB", job_id: String(jobId), transaction_hash: created.transactionHash });

    const registered = await client.registerJob(jobId);
    await onProgress({ stage: "REGISTER_JOB", job_id: String(jobId), transaction_hash: registered.transactionHash });

    const budgeted = await client.setBudget(jobId, 0n);
    await onProgress({ stage: "SET_BUDGET", job_id: String(jobId), transaction_hash: budgeted.transactionHash });

    const funded = await client.fund(jobId, 0n);
    await onProgress({ stage: "FUND", job_id: String(jobId), transaction_hash: funded.transactionHash });
    const fundReceipt = await client.publicClient.getTransactionReceipt({ hash: funded.transactionHash as Hex });

    await sendSkill(messageUrl, { skill: "notify_funded", job_id: Number(jobId) });

    const deadline = Date.now() + 120_000;
    let finalStatus: "SUBMITTED" | "COMPLETED" | null = null;
    while (Date.now() < deadline) {
      const job = await client.getJob(jobId);
      if (job.status === JobStatus.SUBMITTED) { finalStatus = "SUBMITTED"; break; }
      if (job.status === JobStatus.COMPLETED) { finalStatus = "COMPLETED"; break; }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    if (finalStatus === null) throw new Error("timed out waiting for provider SUBMITTED status");

    const job = await client.getJob(jobId);
    const latestBlock = await client.publicClient.getBlockNumber();
    const submitEvents = await client.commerce.getJobSubmittedEvents(
      fundReceipt.blockNumber,
      latestBlock,
      jobId,
    );
    const submitEvent = submitEvents.at(-1);
    if (!submitEvent?.transactionHash) {
      throw new Error("provider submitted the job but no bounded JobSubmitted event was found after funding");
    }

    const submitReceipt = await client.publicClient.getTransactionReceipt({ hash: submitEvent.transactionHash });
    const deliverableUrl = decodeDeliverableUrlFromKnownSubmitReceipt(
      submitReceipt.logs,
      jobId,
      job.deliverable,
    );
    await onProgress({
      stage: "SUBMIT_OBSERVED",
      job_id: String(jobId),
      transaction_hash: submitEvent.transactionHash,
      deliverable_url: deliverableUrl,
    });

    const manifest = await fetchManifest(
      deliverableUrl,
      env.STORAGE_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs/",
    );
    if (!manifest.verify(job.deliverable)) {
      throw new Error("deliverable manifest hash does not match the on-chain job deliverable hash");
    }
    let content: unknown;
    try { content = JSON.parse(manifest.response.content); }
    catch { throw new Error("deliverable manifest response.content is not valid JSON"); }
    const verifiedReceipt = validateLiveSpondeeReceipt(
      content,
      String(previewPromise.promise_id),
      task.scenario_id,
    );
    await onProgress({ stage: "DELIVERABLE_VERIFIED", job_id: String(jobId), deliverable_url: deliverableUrl });

    return {
      network: "bsc-testnet",
      provider_address: expectedProvider,
      buyer_address: buyerAddress,
      job_id: String(jobId),
      status: finalStatus,
      task_schema: task.schema,
      price_raw: "0",
      promise_id: String(previewPromise.promise_id),
      promise_sha256: commitment.promise_sha256,
      job_description_bytes: descriptionBytes,
      transactions: {
        create_job: created.transactionHash,
        register_job: registered.transactionHash,
        set_budget: budgeted.transactionHash,
        fund: funded.transactionHash,
        submit: submitEvent.transactionHash,
      },
      deliverable: {
        url: deliverableUrl,
        manifest_hash_verified: true,
        spondee_receipt_verified: true,
        receipt: verifiedReceipt,
      },
    };
  } finally {
    wallet.destroy();
  }
}
