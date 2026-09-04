import { randomUUID } from "node:crypto";
import {
  DeliverableManifest,
  ERC8183Client,
  JobStatus,
  buildJobDescription,
  verifyQuoteSignature,
} from "@bnbagent/sdk/erc8183";
import { EVMWalletProvider } from "@bnbagent/sdk/wallets";
import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  hexToString,
  http,
  type Hex,
  type Log,
} from "viem";
import {
  BSC_TESTNET,
  SPONDEE_G3_SUBMISSION_WINDOW_SECONDS,
  SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES,
  validateSignedQuoteEnvelope,
  type LiveActivationProgress,
} from "./erc8183.js";

export const G5_BNB_USD_FEED = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE" as const;
export type ForwardRound = { round_id: string; price_usd: number; updated_at: string };

const feedAbi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "latestRoundData", stateMutability: "view", inputs: [], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ] },
  { type: "function", name: "getRoundData", stateMutability: "view", inputs: [{ name: "_roundId", type: "uint80" }], outputs: [
    { name: "roundId", type: "uint80" }, { name: "answer", type: "int256" }, { name: "startedAt", type: "uint256" }, { name: "updatedAt", type: "uint256" }, { name: "answeredInRound", type: "uint80" },
  ] },
] as const;

const jobInitialisedAbi = [{
  anonymous: false,
  type: "event",
  name: "JobInitialised",
  inputs: [
    { indexed: true, name: "jobId", type: "uint256" },
    { indexed: false, name: "deliverable", type: "bytes32" },
    { indexed: false, name: "submittedAt", type: "uint64" },
    { indexed: false, name: "optParams", type: "bytes" },
  ],
}] as const;

type RpcReply = { error?: { message?: string }; result?: { parts?: Array<{ data?: Record<string, unknown> }> } };
type ProgressSink = (event: LiveActivationProgress) => void | Promise<void>;

export interface FrozenFeedRound extends ForwardRound {
  frozen_at: string;
}

export async function freezeBnbUsdRound(rpc = "https://bsc-dataseed.bnbchain.org"): Promise<FrozenFeedRound> {
  const client = createPublicClient({ transport: http(rpc, { timeout: 15_000 }) });
  if (await client.getChainId() !== 56) throw new Error("freeze source must be BSC mainnet");
  const [decimals, description, latest] = await Promise.all([
    client.readContract({ address: getAddress(G5_BNB_USD_FEED), abi: feedAbi, functionName: "decimals" }),
    client.readContract({ address: getAddress(G5_BNB_USD_FEED), abi: feedAbi, functionName: "description" }),
    client.readContract({ address: getAddress(G5_BNB_USD_FEED), abi: feedAbi, functionName: "latestRoundData" }),
  ]);
  if (!String(description).toUpperCase().includes("BNB")) throw new Error(`unexpected feed: ${description}`);
  const [roundId, answer, , updatedAt] = latest;
  if (answer <= 0n || updatedAt <= 0n) throw new Error("invalid freeze round");
  return {
    round_id: roundId.toString(),
    price_usd: Number(answer) / 10 ** Number(decimals),
    updated_at: new Date(Number(updatedAt) * 1000).toISOString(),
    frozen_at: new Date().toISOString(),
  };
}

export async function verifyBnbUsdRounds(
  rounds: ForwardRound[],
  rpc = "https://bsc-dataseed.bnbchain.org",
): Promise<void> {
  const client = createPublicClient({ transport: http(rpc, { timeout: 15_000 }) });
  if (await client.getChainId() !== 56) throw new Error("round verifier must use BSC mainnet");
  const decimals = await client.readContract({ address: getAddress(G5_BNB_USD_FEED), abi: feedAbi, functionName: "decimals" });
  for (const expected of rounds) {
    const [roundId, answer, , updatedAt] = await client.readContract({
      address: getAddress(G5_BNB_USD_FEED),
      abi: feedAbi,
      functionName: "getRoundData",
      args: [BigInt(expected.round_id)],
    });
    const price = Number(answer) / 10 ** Number(decimals);
    const timestamp = new Date(Number(updatedAt) * 1000).toISOString();
    if (roundId.toString() !== expected.round_id) throw new Error(`Chainlink round id mismatch ${expected.round_id}`);
    if (Math.abs(price - expected.price_usd) > 1e-8) throw new Error(`Chainlink price mismatch ${expected.round_id}`);
    if (timestamp !== expected.updated_at) throw new Error(`Chainlink timestamp mismatch ${expected.round_id}`);
  }
}

async function sendSkill(url: string, data: Record<string, unknown>, timeoutMs: number): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "message/send",
      params: { message: { kind: "message", role: "user", messageId: randomUUID(), parts: [{ kind: "data", data }] } },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`seller HTTP ${response.status}`);
  const body = await response.json() as RpcReply;
  if (body.error) throw new Error(`seller error: ${body.error.message ?? "unknown"}`);
  const part = body.result?.parts?.[0]?.data;
  if (!part) throw new Error("seller returned no data part");
  return part;
}

function decodeCommitmentFromTerms(terms: unknown, prefix: string): Record<string, unknown> | null {
  if (terms === null || typeof terms !== "object" || Array.isArray(terms)) return null;
  const criteria = (terms as Record<string, unknown>).success_criteria;
  if (!Array.isArray(criteria)) return null;
  const matches = criteria.filter((x): x is string => typeof x === "string" && x.startsWith(prefix));
  if (matches.length !== 1) return null;
  try {
    const parsed = JSON.parse(Buffer.from(matches[0].slice(prefix.length), "base64url").toString("utf8"));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function decodeDeliverableUrl(logs: readonly Log[], jobId: bigint, expected: Hex): string {
  for (const log of logs) {
    if (log.address.toLowerCase() !== BSC_TESTNET.optimisticPolicy.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: jobInitialisedAbi, eventName: "JobInitialised", data: log.data, topics: log.topics });
      const args = decoded.args as { jobId: bigint; deliverable: Hex; submittedAt: bigint; optParams: Hex };
      if (args.jobId !== jobId) continue;
      if (args.deliverable.toLowerCase() !== expected.toLowerCase()) throw new Error("JobInitialised deliverable mismatch");
      const params = JSON.parse(hexToString(args.optParams)) as { deliverable_url?: unknown };
      if (typeof params.deliverable_url !== "string" || !params.deliverable_url) throw new Error("JobInitialised missing deliverable_url");
      return params.deliverable_url;
    } catch (error) {
      if (error instanceof Error && error.message.includes("deliverable")) throw error;
    }
  }
  throw new Error(`JobInitialised(${jobId}) not found in exact submit receipt`);
}

async function fetchManifest(url: string, gatewayUrl: string): Promise<DeliverableManifest> {
  const resolved = url.startsWith("ipfs://") ? `${gatewayUrl.replace(/\/+$/, "")}/${url.slice(7)}` : url;
  if (resolved.startsWith("file://")) throw new Error("forward observed proof refuses file:// deliverables");
  const response = await fetch(resolved, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`deliverable manifest HTTP ${response.status}`);
  return DeliverableManifest.fromDict(await response.json() as Record<string, unknown>);
}

export interface ForwardMarketplaceConfig<TTask, TPromise, TOutput, TBaseline> {
  executionFlag: string;
  sellerUrlEnv: string;
  previewSkill: string;
  categoryLabel: string;
  taskDescription: (task: TTask) => string;
  expectedPromise: (task: TTask) => TPromise;
  expectedCommitment: (promise: TPromise) => Record<string, unknown>;
  commitmentPrefix: string;
  maxWaitSeconds: (task: TTask) => number;
  parseOutput: (value: unknown) => TOutput;
  outputRounds: (output: TOutput) => ForwardRound[];
  evaluateBaseline: (task: TTask, rounds: ForwardRound[]) => TBaseline;
  outputScenarioId: (output: TOutput) => string;
  taskScenarioId: (task: TTask) => string;
  promiseId: (promise: TPromise) => string;
}

export interface ForwardMarketplaceResult<TTask, TPromise, TOutput, TBaseline> {
  network: "bsc-testnet";
  provider_address: string;
  buyer_address: string;
  job_id: string;
  status: "SUBMITTED" | "COMPLETED";
  task: TTask;
  promise: TPromise;
  funded_at: string;
  transactions: { create_job: string; register_job: string; set_budget: string; fund: string; submit: string };
  deliverable_url: string;
  deliverable_hash: string;
  agent_output: TOutput;
  baseline_output: TBaseline;
  external_round_verification: "PASS";
  manifest_hash_verified: true;
  buyer_wallet_paid_wei: "0";
}

export async function runForwardMarketplaceActivation<TTask, TPromise, TOutput, TBaseline>(
  task: TTask,
  config: ForwardMarketplaceConfig<TTask, TPromise, TOutput, TBaseline>,
  env = process.env,
  onProgress: ProgressSink = () => undefined,
): Promise<ForwardMarketplaceResult<TTask, TPromise, TOutput, TBaseline>> {
  if (env[config.executionFlag] !== "true") throw new Error(`${config.categoryLabel} execution gate is closed`);
  if (env.SPONDEE_LIVE_TESTNET_ENABLED !== "true") throw new Error("BSC testnet live gate is closed");
  if (env.BNBAGENT_USE_PAYMASTER !== "1") throw new Error("MegaFuel is required");
  const sellerUrl = env[config.sellerUrlEnv]?.trim();
  if (!sellerUrl) throw new Error(`${config.sellerUrlEnv} is required`);
  const expectedProvider = getAddress(env.SPONDEE_PROVIDER_ADDRESS ?? "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8");
  if (!env.BUYER_WALLET_ADDRESS || !env.BUYER_WALLETS_DIR || !env.BUYER_WALLET_PASSWORD) throw new Error("ephemeral buyer wallet configuration is required");
  const buyerAddress = getAddress(env.BUYER_WALLET_ADDRESS);
  const wallet = new EVMWalletProvider({ password: env.BUYER_WALLET_PASSWORD, address: buyerAddress, walletsDir: env.BUYER_WALLETS_DIR, persist: true });

  try {
    const taskDescription = config.taskDescription(task);
    const previewRaw = await sendSkill(sellerUrl, { skill: config.previewSkill, task_description: taskDescription }, 30_000);
    if (previewRaw.status !== "ok" || previewRaw.promise === null || typeof previewRaw.promise !== "object") throw new Error("seller rejected forward Promise preview");
    const expectedPromise = config.expectedPromise(task);
    if (JSON.stringify(previewRaw.promise) !== JSON.stringify(expectedPromise)) throw new Error("seller preview Promise differs from frozen task");

    const quoteRaw = await sendSkill(sellerUrl, {
      skill: "negotiate",
      task_description: taskDescription,
      terms: {
        deliverables: `${config.categoryLabel} forward observed output`,
        quality_standards: "Future Chainlink rounds only; no mainnet value movement; zero service price",
      },
    }, 30_000);
    const quote = validateSignedQuoteEnvelope(quoteRaw);
    if (quote.response.terms.price !== "0") throw new Error(`observed proof refuses non-zero service price: ${quote.response.terms.price}`);
    if (quote.request.task_description !== taskDescription) throw new Error("signed task description mismatch");
    const requestCommitment = decodeCommitmentFromTerms(quote.request.terms, config.commitmentPrefix);
    const responseCommitment = decodeCommitmentFromTerms(quote.response.terms, config.commitmentPrefix);
    if (!requestCommitment || !responseCommitment) throw new Error("signed quote lacks unique forward commitment");
    if (JSON.stringify(requestCommitment) !== JSON.stringify(responseCommitment)) throw new Error("request/response commitments differ");
    if (JSON.stringify(requestCommitment) !== JSON.stringify(config.expectedCommitment(expectedPromise))) throw new Error("signed commitment differs from preview Promise");

    const client = await ERC8183Client.create({ walletProvider: wallet, network: "bsc-testnet" });
    const paymentToken = await client.paymentToken();
    if (getAddress(String(quote.response.terms.currency)) !== getAddress(paymentToken)) throw new Error("quote currency does not match Commerce token");
    const verdict = await verifyQuoteSignature({ envelope: quote, provider: expectedProvider, publicClient: client.publicClient, expectedVerifyingContract: client.commerce.address });
    if (!verdict.valid) throw new Error(`provider quote rejected: ${verdict.reason}`);

    const description = buildJobDescription(quote, SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES);
    const bytes = Buffer.byteLength(description, "utf8");
    if (bytes > SPONDEE_MEGAFUEL_DESCRIPTION_MAX_BYTES) throw new Error(`MegaFuel description budget exceeded: ${bytes}`);
    const disputeWindow = await client.policy.disputeWindow();
    const expiredAt = BigInt(Math.floor(Date.now() / 1000)) + disputeWindow + SPONDEE_G3_SUBMISSION_WINDOW_SECONDS;

    const created = await client.createJob({ provider: expectedProvider, expiredAt, description });
    if (created.jobId === null) throw new Error("createJob returned no jobId");
    const jobId = created.jobId;
    await onProgress({ stage: "CREATE_JOB", job_id: String(jobId), transaction_hash: created.transactionHash });
    const registered = await client.registerJob(jobId);
    await onProgress({ stage: "REGISTER_JOB", job_id: String(jobId), transaction_hash: registered.transactionHash });
    const budgeted = await client.setBudget(jobId, 0n);
    await onProgress({ stage: "SET_BUDGET", job_id: String(jobId), transaction_hash: budgeted.transactionHash });
    const funded = await client.fund(jobId, 0n);
    await onProgress({ stage: "FUND", job_id: String(jobId), transaction_hash: funded.transactionHash });
    const fundReceipt = await client.publicClient.getTransactionReceipt({ hash: funded.transactionHash as Hex });
    const fundBlock = await client.publicClient.getBlock({ blockNumber: fundReceipt.blockNumber });
    const fundedAt = new Date(Number(fundBlock.timestamp) * 1000).toISOString();

    const notify = await sendSkill(sellerUrl, { skill: "notify_funded", job_id: Number(jobId), wait_for_result: true }, (config.maxWaitSeconds(task) + 180) * 1000);
    if (notify.ok !== true || String(notify.job_id) !== String(jobId)) throw new Error(`seller did not return terminal success for job ${jobId}`);
    const submitHash = String(notify.tx_hash ?? "");
    if (!/^0x[0-9a-fA-F]{64}$/.test(submitHash)) throw new Error("seller returned invalid submit tx hash");
    const submitReceipt = await client.publicClient.getTransactionReceipt({ hash: submitHash as Hex });
    if (submitReceipt.status !== "success") throw new Error("provider submit transaction failed");

    let finalStatus: "SUBMITTED" | "COMPLETED" | null = null;
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const job = await client.getJob(jobId);
      if (job.status === JobStatus.SUBMITTED) { finalStatus = "SUBMITTED"; break; }
      if (job.status === JobStatus.COMPLETED) { finalStatus = "COMPLETED"; break; }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    if (!finalStatus) throw new Error("timed out waiting for submitted job state");
    const job = await client.getJob(jobId);
    const deliverableUrl = decodeDeliverableUrl(submitReceipt.logs, jobId, job.deliverable);
    await onProgress({ stage: "SUBMIT_OBSERVED", job_id: String(jobId), transaction_hash: submitHash, deliverable_url: deliverableUrl });

    const manifest = await fetchManifest(deliverableUrl, env.STORAGE_GATEWAY_URL ?? "https://gateway.pinata.cloud/ipfs/");
    if (!manifest.verify(job.deliverable)) throw new Error("deliverable manifest hash mismatch");
    let parsed: unknown;
    try { parsed = JSON.parse(manifest.response.content); } catch { throw new Error("deliverable response is not JSON"); }
    const agentOutput = config.parseOutput(parsed);
    if (config.outputScenarioId(agentOutput) !== config.taskScenarioId(task)) throw new Error("agent output scenario mismatch");
    const rounds = config.outputRounds(agentOutput);
    if (rounds.length < 5) throw new Error("insufficient observed rounds");
    for (const round of rounds) {
      if (Date.parse(round.updated_at) <= Date.parse(fundedAt)) throw new Error("observed round predates marketplace funding");
    }
    await verifyBnbUsdRounds(rounds, env.SPONDEE_G5_BSC_MAINNET_RPC?.trim() || "https://bsc-dataseed.bnbchain.org");
    const baselineOutput = config.evaluateBaseline(task, rounds);
    await onProgress({ stage: "DELIVERABLE_VERIFIED", job_id: String(jobId), deliverable_url: deliverableUrl });

    return {
      network: "bsc-testnet",
      provider_address: expectedProvider,
      buyer_address: buyerAddress,
      job_id: String(jobId),
      status: finalStatus,
      task,
      promise: expectedPromise,
      funded_at: fundedAt,
      transactions: {
        create_job: created.transactionHash,
        register_job: registered.transactionHash,
        set_budget: budgeted.transactionHash,
        fund: funded.transactionHash,
        submit: submitHash,
      },
      deliverable_url: deliverableUrl,
      deliverable_hash: job.deliverable,
      agent_output: agentOutput,
      baseline_output: baselineOutput,
      external_round_verification: "PASS",
      manifest_hash_verified: true,
      buyer_wallet_paid_wei: "0",
    };
  } finally {
    wallet.destroy();
  }
}
