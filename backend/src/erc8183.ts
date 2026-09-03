import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  DeliverableManifest,
  ERC8183Client,
  ERC8183_PAYMASTER_CHAIN_IDS,
  JobStatus,
  buildJobDescription,
  verifyQuoteSignature,
} from "@bnbagent/sdk/erc8183";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import { getAddress } from "viem";
import type { SpondeeTask } from "./contracts.js";

export const BSC_TESTNET = {
  chainId: 97,
  rpc: "https://bsc-testnet-dataseed.bnbchain.org",
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  commerce: "0xa206c0517b6371c6638cd9e4a42cc9f02a33b0de",
  evaluatorRouter: "0xd7d36d66d2f1b608a0f943f722d27e3744f66f25",
  optimisticPolicy: "0xd6a4217588f6b1f5657a92a3e94e6422ad771cea",
} as const;

const DEFAULT_PROVIDER = "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8";
const SPONDEE_PROMISE_COMMITMENT_PREFIX = "SPONDEE_PROMISE_COMMITMENT_V1:";
const SPONDEE_TASK_B64_PREFIX = "SPONDEE_TASK_B64_V1:";

/**
 * Conservative application-level ceiling below the SDK's 4096-byte cap.
 * The third bounded live attempt proved that MegaFuel can reject a valid
 * SDK description before that protocol cap when the resulting raw createJob
 * transaction is too large. Keep the Spondee description compact enough to
 * leave ABI/RLP overhead for the relay rather than falling through to a
 * zero-balance self-pay attempt.
 */
export const SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES = 1600;

interface RpcReply {
  error?: { message?: string };
  result?: { parts?: Array<{ data?: Record<string, unknown> }> };
}

export interface SpondeePromiseCommitment {
  schema: "spondee.promise-commitment.v1";
  promise_id: string;
  scenario_id: string;
  price_raw: string;
  promise_sha256: string;
}

/**
 * Official @bnbagent/sdk NegotiationResult.toDict() wire shape.
 *
 * Provider identity is proven cryptographically with verifyQuoteSignature().
 * Spondee binds a compact Promise commitment inside success_criteria, an
 * official TermSpecification field preserved in both the quote signature and
 * the on-chain JobDescription. The full Promise Card stays off-chain and is
 * verified against that signed commitment before any createJob write.
 */
export interface SignedQuote extends Record<string, unknown> {
  request: {
    task_description?: unknown;
    terms?: {
      success_criteria?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  response: {
    accepted: boolean;
    terms: {
      price: string;
      currency?: string;
      success_criteria?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  request_hash?: string;
  response_hash?: string;
  negotiation_hash: string;
  provider_sig: string;
  chain_id?: number;
  verifying_contract?: string;
}

async function sendSkill(
  messageUrl: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const body = {
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
  };
  const response = await fetch(messageUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`seller A2A HTTP ${response.status}`);
  const reply = (await response.json()) as RpcReply;
  if (reply.error) throw new Error(`seller A2A error: ${reply.error.message ?? "unknown"}`);
  const dataPart = reply.result?.parts?.[0]?.data;
  if (!dataPart) throw new Error("seller A2A response contained no data part");
  return dataPart;
}

export async function publicTestnetReadiness(
  providerAddress = DEFAULT_PROVIDER,
  rpc = BSC_TESTNET.rpc,
) {
  const jsonRpc = async (method: string, params: unknown[]) => {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`BSC testnet RPC HTTP ${response.status}`);
    const payload = (await response.json()) as { result?: string; error?: unknown };
    if (payload.error || payload.result === undefined) {
      throw new Error(`BSC testnet RPC error: ${JSON.stringify(payload.error)}`);
    }
    return payload.result;
  };

  const [chainIdHex, balanceHex, commerceCode, routerCode, policyCode] = await Promise.all([
    jsonRpc("eth_chainId", []),
    jsonRpc("eth_getBalance", [providerAddress, "latest"]),
    jsonRpc("eth_getCode", [BSC_TESTNET.commerce, "latest"]),
    jsonRpc("eth_getCode", [BSC_TESTNET.evaluatorRouter, "latest"]),
    jsonRpc("eth_getCode", [BSC_TESTNET.optimisticPolicy, "latest"]),
  ]);
  const balanceWei = BigInt(balanceHex);
  const paymasterSupported = ERC8183_PAYMASTER_CHAIN_IDS.has(BSC_TESTNET.chainId);
  return {
    network: "bsc-testnet" as const,
    chain_id: Number(BigInt(chainIdHex)),
    provider_address: getAddress(providerAddress),
    provider_balance_wei: balanceWei.toString(),
    funded_for_gas: balanceWei > 0n,
    sdk_erc8183_paymaster_supported: paymasterSupported,
    gas_note: paymasterSupported
      ? "Pinned @bnbagent/sdk marks chain 97 as ERC-8183 paymaster-supported. tBNB remains a useful fallback because relay availability is runtime-dependent."
      : "Pinned @bnbagent/sdk does not mark this chain as ERC-8183 paymaster-supported; self-paid tBNB gas is required.",
    contracts: {
      commerce_has_code: commerceCode !== "0x",
      evaluator_router_has_code: routerCode !== "0x",
      optimistic_policy_has_code: policyCode !== "0x",
    },
    live_write_attempted: false,
  };
}

export function liveGateStatus(env = process.env) {
  const enabled = env.SPONDEE_LIVE_TESTNET_ENABLED === "true";
  const sellerUrl = env.SPONDEE_SELLER_A2A_URL?.trim() ?? "";
  const buyerAddress = env.BUYER_WALLET_ADDRESS?.trim() ?? "";
  const buyerDir = env.BUYER_WALLETS_DIR?.trim() ?? "";
  const hasPassword = Boolean(env.BUYER_WALLET_PASSWORD);
  return {
    enabled,
    seller_url_configured: sellerUrl.length > 0,
    buyer_address_configured: /^0x[a-fA-F0-9]{40}$/.test(buyerAddress),
    buyer_keystore_dir_configured: buyerDir.length > 0,
    buyer_password_present: hasPassword,
    ready_for_live_write:
      enabled &&
      sellerUrl.length > 0 &&
      /^0x[a-fA-F0-9]{40}$/.test(buyerAddress) &&
      buyerDir.length > 0 &&
      hasPassword,
  };
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashSpondeePromise(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

export function encodeSpondeeHealthFactorTask(task: SpondeeTask): string {
  return `${SPONDEE_TASK_B64_PREFIX}${Buffer.from(
    JSON.stringify(task),
    "utf8",
  ).toString("base64url")}`;
}

/** Validate the protocol shape before any on-chain write is attempted. */
export function validateSignedQuoteEnvelope(value: unknown): SignedQuote {
  const quote = objectOrNull(value);
  if (!quote) throw new Error("seller returned a non-object ERC-8183 quote envelope");

  const request = objectOrNull(quote.request);
  const response = objectOrNull(quote.response);
  const terms = objectOrNull(response?.terms);
  if (!request || !response || !terms) {
    throw new Error("seller returned an invalid ERC-8183 quote envelope");
  }
  if (response.accepted !== true) {
    const reason = typeof response.reason === "string" ? `: ${response.reason}` : "";
    throw new Error(`seller rejected the ERC-8183 negotiation${reason}`);
  }
  if (typeof terms.price !== "string" || terms.price.length === 0) {
    throw new Error("accepted ERC-8183 quote is missing price");
  }
  if (typeof quote.negotiation_hash !== "string" || quote.negotiation_hash.length === 0) {
    throw new Error("accepted ERC-8183 quote is missing negotiation_hash");
  }
  if (typeof quote.provider_sig !== "string" || quote.provider_sig.length === 0) {
    throw new Error("accepted ERC-8183 quote is missing provider_sig");
  }

  return quote as SignedQuote;
}

function uniqueCommitmentCarrier(value: unknown, side: "request" | "response"): string {
  if (!Array.isArray(value)) {
    throw new Error(`signed ${side} is missing success_criteria Promise commitment`);
  }
  const matches = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith(SPONDEE_PROMISE_COMMITMENT_PREFIX),
  );
  if (matches.length !== 1) {
    throw new Error(
      `signed ${side} must contain exactly one Spondee Promise commitment; found ${matches.length}`,
    );
  }
  return matches[0];
}

function decodeCommitmentCarrier(carrier: string): SpondeePromiseCommitment {
  let raw: unknown;
  try {
    raw = JSON.parse(carrier.slice(SPONDEE_PROMISE_COMMITMENT_PREFIX.length));
  } catch {
    throw new Error("signed Spondee Promise commitment is not valid JSON");
  }
  const parsed = objectOrNull(raw);
  if (!parsed) throw new Error("signed Spondee Promise commitment is not an object");
  if (
    typeof parsed.p !== "string" ||
    typeof parsed.s !== "string" ||
    typeof parsed.r !== "string" ||
    !/^\d+$/.test(parsed.r) ||
    typeof parsed.h !== "string" ||
    !/^[a-f0-9]{64}$/.test(parsed.h)
  ) {
    throw new Error("signed Spondee Promise commitment has invalid fields");
  }
  return {
    schema: "spondee.promise-commitment.v1",
    promise_id: parsed.p,
    scenario_id: parsed.s,
    price_raw: parsed.r,
    promise_sha256: parsed.h,
  };
}

export function signedSpondeePromiseCommitmentFromQuote(
  quote: SignedQuote,
): SpondeePromiseCommitment {
  const requestCarrier = uniqueCommitmentCarrier(
    quote.request?.terms?.success_criteria,
    "request",
  );
  const responseCarrier = uniqueCommitmentCarrier(
    quote.response?.terms?.success_criteria,
    "response",
  );
  if (requestCarrier !== responseCarrier) {
    throw new Error("signed request/response Spondee Promise commitments do not match");
  }
  return decodeCommitmentCarrier(requestCarrier);
}

export function validatePreviewPromise(
  value: unknown,
  expectedScenarioId: string,
): Record<string, unknown> {
  const promise = objectOrNull(value);
  if (!promise || promise.schema !== "spondee.promise-card.v1") {
    throw new Error("seller preview did not return a Spondee Promise Card");
  }
  if (typeof promise.promise_id !== "string" || promise.promise_id.length === 0) {
    throw new Error("seller preview Promise Card is missing promise_id");
  }
  if (promise.scenario_id !== expectedScenarioId) {
    throw new Error("seller preview Promise Card scenario does not match the task");
  }
  if (promise.evidence_class !== "SIMULATION") {
    throw new Error("G3 seller preview Promise Card must remain SIMULATION");
  }
  const expectedCost = objectOrNull(promise.expected_cost);
  if (!expectedCost || typeof expectedCost.amount !== "string") {
    throw new Error("seller preview Promise Card is missing expected_cost.amount");
  }
  return promise;
}

export function validatePromiseAgainstCommitment(
  promise: Record<string, unknown>,
  commitment: SpondeePromiseCommitment,
): void {
  const expectedCost = objectOrNull(promise.expected_cost);
  if (promise.promise_id !== commitment.promise_id) {
    throw new Error("preview Promise Card promise_id does not match signed commitment");
  }
  if (promise.scenario_id !== commitment.scenario_id) {
    throw new Error("preview Promise Card scenario does not match signed commitment");
  }
  if (expectedCost?.amount !== commitment.price_raw) {
    throw new Error("preview Promise Card price does not match signed commitment");
  }
  if (hashSpondeePromise(promise) !== commitment.promise_sha256) {
    throw new Error("preview Promise Card hash does not match signed commitment");
  }
}

export function validateLiveSpondeeReceipt(
  value: unknown,
  expectedPromiseId: string,
  expectedScenarioId: string,
): Record<string, unknown> {
  const receipt = objectOrNull(value);
  if (!receipt) throw new Error("deliverable content is not a JSON object");
  if (receipt.schema !== "spondee.outcome-receipt.v1") {
    throw new Error("deliverable is not a Spondee Outcome Receipt");
  }
  if (receipt.promise_id !== expectedPromiseId) {
    throw new Error("deliverable promise_id does not match the committed Promise Card");
  }
  if (receipt.scenario_id !== expectedScenarioId) {
    throw new Error("deliverable scenario_id does not match the requested scenario");
  }
  if (receipt.evidence_class !== "SIMULATION") {
    throw new Error(
      "G3 Health Factor declared-stress receipt must remain SIMULATION until observed market evidence exists",
    );
  }
  const calibration = objectOrNull(receipt.calibration);
  if (calibration?.eligible_for_observed_agent_advantage !== false) {
    throw new Error("simulation deliverable cannot be eligible for observed Agent Advantage");
  }
  return receipt;
}

async function fetchManifest(
  deliverableUrl: string,
  gatewayUrl: string,
): Promise<DeliverableManifest> {
  let raw: string;
  if (deliverableUrl.startsWith("file://")) {
    raw = await readFile(fileURLToPath(deliverableUrl), "utf8");
  } else {
    const url = deliverableUrl.startsWith("ipfs://")
      ? `${gatewayUrl.replace(/\/+$/, "")}/${deliverableUrl.slice("ipfs://".length)}`
      : deliverableUrl;
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`deliverable manifest HTTP ${response.status}`);
    raw = await response.text();
  }
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return DeliverableManifest.fromDict(parsed);
}

export type LiveProgressStage =
  | "CREATE_JOB"
  | "REGISTER_JOB"
  | "SET_BUDGET"
  | "FUND"
  | "SUBMIT_OBSERVED"
  | "DELIVERABLE_VERIFIED";

export interface LiveActivationProgress {
  stage: LiveProgressStage;
  job_id: string;
  transaction_hash?: string;
  deliverable_url?: string;
}

type ProgressSink = (progress: LiveActivationProgress) => Promise<void> | void;

export interface LiveTestnetResult {
  network: "bsc-testnet";
  provider_address: string;
  buyer_address: string;
  job_id: string;
  status: "SUBMITTED" | "COMPLETED";
  price_raw: "0";
  quote_negotiation_hash: string | null;
  promise_id: string;
  promise_sha256: string;
  job_description_bytes: number;
  transactions: {
    create_job: string;
    register_job: string;
    set_budget: string;
    fund: string;
    submit: string | null;
  };
  deliverable: {
    url: string;
    manifest_hash_verified: true;
    spondee_receipt_verified: true;
    receipt: Record<string, unknown>;
  };
}

export async function runSignedZeroPriceTestnetActivation(
  task: SpondeeTask,
  env = process.env,
  onProgress: ProgressSink = () => undefined,
): Promise<LiveTestnetResult> {
  if (task.schema !== "spondee.health-factor.task.v1") {
    throw new Error(
      "The current live Agent Studio reference seller is Health Factor only; other categories remain simulation-only until their reference-agent deployment gates pass.",
    );
  }
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
    const taskDescription = encodeSpondeeHealthFactorTask(task);
    const previewRaw = await sendSkill(messageUrl, {
      skill: "preview_health_factor",
      task_description: taskDescription,
    });
    if (previewRaw.status !== "ok") {
      throw new Error("seller rejected the read-only Health Factor Promise preview");
    }
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
      throw new Error(`G3 live activation refuses non-zero service price: ${quote.response.terms.price}`);
    }

    const client = await ERC8183Client.create({
      walletProvider: wallet,
      network: "bsc-testnet",
    });
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
      throw new Error("signed task description does not match the encoded Health Factor task");
    }
    const commitment = signedSpondeePromiseCommitmentFromQuote(quote);
    if (commitment.scenario_id !== task.scenario_id) {
      throw new Error("signed Promise commitment scenario does not match the live activation task");
    }
    if (commitment.price_raw !== quote.response.terms.price) {
      throw new Error("signed Promise commitment price does not match the ERC-8183 quote price");
    }
    validatePromiseAgainstCommitment(previewPromise, commitment);
    const promiseId = String(previewPromise.promise_id);

    const description = buildJobDescription(
      quote,
      SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES,
    );
    const descriptionBytes = Buffer.byteLength(description, "utf8");
    if (descriptionBytes > SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES) {
      throw new Error(
        `Spondee MegaFuel description budget exceeded: ${descriptionBytes} bytes`,
      );
    }

    const disputeWindow = await client.policy.disputeWindow();
    const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + disputeWindow + 600n;
    const created = await client.createJob({
      provider: expectedProvider,
      expiredAt,
      description,
    });
    if (created.jobId === null) throw new Error("createJob did not return jobId");
    const jobId = created.jobId;
    await onProgress({
      stage: "CREATE_JOB",
      job_id: jobId.toString(),
      transaction_hash: created.transactionHash,
    });

    const registered = await client.registerJob(jobId);
    await onProgress({
      stage: "REGISTER_JOB",
      job_id: jobId.toString(),
      transaction_hash: registered.transactionHash,
    });

    const budgeted = await client.setBudget(jobId, 0n);
    await onProgress({
      stage: "SET_BUDGET",
      job_id: jobId.toString(),
      transaction_hash: budgeted.transactionHash,
    });

    const funded = await client.fund(jobId, 0n);
    await onProgress({
      stage: "FUND",
      job_id: jobId.toString(),
      transaction_hash: funded.transactionHash,
    });

    await sendSkill(messageUrl, { skill: "notify_funded", job_id: Number(jobId) });

    const deadline = Date.now() + 120_000;
    let finalStatus: "SUBMITTED" | "COMPLETED" | null = null;
    while (Date.now() < deadline) {
      const job = await client.getJob(jobId);
      if (job.status === JobStatus.SUBMITTED) {
        finalStatus = "SUBMITTED";
        break;
      }
      if (job.status === JobStatus.COMPLETED) {
        finalStatus = "COMPLETED";
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    if (finalStatus === null) throw new Error("timed out waiting for provider SUBMITTED status");

    const job = await client.getJob(jobId);
    const deliverableUrl = await client.getDeliverableUrl(jobId);
    if (!deliverableUrl) throw new Error("submitted job has no on-chain deliverable_url");

    const latestBlock = await client.publicClient.getBlockNumber();
    const fromBlock = latestBlock > 999n ? latestBlock - 999n : 0n;
    const submitEvents = await client.commerce.getJobSubmittedEvents(
      fromBlock,
      latestBlock,
      jobId,
    );
    const submitEvent = submitEvents.at(-1) ?? null;
    if (submitEvent?.transactionHash) {
      await onProgress({
        stage: "SUBMIT_OBSERVED",
        job_id: jobId.toString(),
        transaction_hash: submitEvent.transactionHash,
        deliverable_url: deliverableUrl,
      });
    }

    const gatewayUrl = env.STORAGE_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs/";
    const manifest = await fetchManifest(deliverableUrl, gatewayUrl);
    if (!manifest.verify(job.deliverable)) {
      throw new Error("deliverable manifest hash does not match the on-chain job deliverable hash");
    }
    let deliverableContent: unknown;
    try {
      deliverableContent = JSON.parse(manifest.response.content);
    } catch {
      throw new Error("deliverable manifest response.content is not valid JSON");
    }
    const verifiedReceipt = validateLiveSpondeeReceipt(
      deliverableContent,
      promiseId,
      task.scenario_id,
    );
    await onProgress({
      stage: "DELIVERABLE_VERIFIED",
      job_id: jobId.toString(),
      deliverable_url: deliverableUrl,
    });

    return {
      network: "bsc-testnet",
      provider_address: expectedProvider,
      buyer_address: buyerAddress,
      job_id: jobId.toString(),
      status: finalStatus,
      price_raw: "0",
      quote_negotiation_hash:
        typeof quote.negotiation_hash === "string" ? quote.negotiation_hash : null,
      promise_id: promiseId,
      promise_sha256: commitment.promise_sha256,
      job_description_bytes: descriptionBytes,
      transactions: {
        create_job: created.transactionHash,
        register_job: registered.transactionHash,
        set_budget: budgeted.transactionHash,
        fund: funded.transactionHash,
        submit: submitEvent?.transactionHash ?? null,
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
