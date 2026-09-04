import { verifyGrid954Receipt } from "./verify-g4-grid-954.js";

async function main(): Promise<void> {
  const chain = await verifyGrid954Receipt();
  console.log(JSON.stringify({
    schema: "spondee.g4-grid-job-954-chain-proof.v1",
    network: "bsc-testnet",
    chain_id: 97,
    category: "grid",
    provider_address: chain.job.provider,
    buyer_address: chain.job.client,
    job_id: chain.job.id.toString(),
    status: Number(chain.job.status) === 3 ? "COMPLETED" : "SUBMITTED",
    submit_transaction_hash: "0xf279d0f3b215ed6b92449fcaf93517a42f7c309190ab923aabd010d034a0e6f3",
    submit_block: chain.receipt.blockNumber.toString(),
    deliverable_url: chain.deliverableUrl,
    deliverable_hash: chain.job.deliverable,
    promise_id: chain.commitment.promiseId,
    promise_sha256: chain.commitment.promiseSha256,
    scenario_id: chain.commitment.scenarioId,
    receipt_log_scan_used: false,
    secrets_printed: false,
    conclusion: "SPONDEE_G4_GRID_JOB_954_CHAIN_RECEIPT_PROOF_PASS",
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
