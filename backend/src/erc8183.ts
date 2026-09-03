import { randomUUID } from "node:crypto";
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
const SPONDEE_PROMISE_CRITERION_PREFIX = "SPONDEE_PROMISE_CARD_V1:";

interface RpcReply {
  error?: { message?: string };
  result?: { parts?: Array<{ data?: Record<string, unknown> }> };
}

/**
 * Official @bnbagent/sdk NegotiationResult.toDict() wire shape.
 *
 * Important: the SDK envelope does NOT contain provider_address. Provider
 * identity is proven cryptographically by verifyQuoteSignature() against the
 * configured expected provider address and Commerce verifying contract.
 *
 * Spondee-specific Promise data rides inside `success_criteria`, one of the
 * TermSpecification fields that the SDK actually preserves in request and
 * response hashes/signatures. Arbitrary custom term keys are intentionally
 * not relied on because NegotiationRequest.fromDict() drops them.
 */
export interface SignedQuote extends Record<string, unknown> {
  request: {
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

  // The official SDK envelope intentionally has no provider_address field.
  // Provider identity is verified later with verifyQuoteSignature(expectedProvider).
  return quote as SignedQuote;
}

function uniquePromiseCarrier(value: unknown, side: "request" | "response"): string {
  if (!Array.isArray(value)) {
    throw new Error(`signed ${side} is missing success_criteria Promise Card carrier`);
  }
  const matches = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.startsWith(SPONDEE_PROMISE_CRITERION_PREFIX),
  );
  if (matches.length !== 1) {
    throw new Error(
      `signed ${side} must contain exactly one Spondee Promise Card carrier; found ${matches.length}`,
    );
  }
  return matches[0];
}

function decodePromiseCarrier(carrier: string): Record<string, unknown> {
  let promise: unknown;
  try {
    promise = JSON.parse(carrier.slice(SPONDEE_PROMISE_CRITERION_PREFIX.length));
  } catch {
    throw new Error("signed Spondee Promise Card carrier is not valid JSON");
  }
  const parsed = objectOrNull(promise);
  if (!parsed || parsed.schema !== "spondee.promise-card.v1") {
    throw new Error("signed success_criteria carrier is not a Spondee Promise Card");
  }
  if (typeof parsed.promise_id !== "string" || parsed.promise_id.length === 0) {
    throw new Error("signed Promise Card is missing promise_id");
  }
  if (typeof parsed.scenario_id !== "string" || parsed.scenario_id.length === 0) {
    throw new Error("signed Promise Card is missing scenario_id");
  }
  return parsed;
}

/**
 * Extract the Spondee Promise only from terms preserved by the official SDK.
 * Request and response must carry the exact same versioned criterion string,
 * so the Promise is covered consistently by both sides of the signed quote.
 */
export function signedSpondeePromiseFromQuote(quote: SignedQuote): Record<string, unknown> {
  const requestCarrier = uniquePromiseCarrier(
    quote.request?.terms?.success_criteria,
    "request",
  );
  const responseCarrier = uniquePromiseCarrier(
    quote.response?.terms?.success_criteria,
    "response",
  );
  if (requestCarrier !== responseCarrier) {
    throw new Error("signed request/response Spondee Promise Card carriers do not match");
  }
  return decodePromiseCarrier(requestCarrier);
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
    throw new Error("deliverable promise_id does not match the signed Promise Card");
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
    const quoteRaw = await sendSkill(messageUrl, {
      skill: "negotiate",
      task_description: JSON.stringify(task),
      terms: {
        deliverables: "Spondee Outcome Receipt",
        quality_standards:
          "Preserve promise_id, scenario_id, evidence class, zero service price and claim guardrails",
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

    // Only trust the Promise after the complete official quote envelope has
    // passed provider/chain/Commerce signature verification.
    const signedPromise = signedSpondeePromiseFromQuote(quote);
    if (signedPromise.scenario_id !== task.scenario_id) {
      throw new Error("signed Promise Card scenario does not match the live activation task");
    }
    const promiseId = String(signedPromise.promise_id);

    const description = buildJobDescription(quote);
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

    const gatewayUrl =
      env.STORAGE_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs/";
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
