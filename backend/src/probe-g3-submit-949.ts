import { verifySubmittedReceipt949 } from "./verify-g3-submitted.js";

const result = await verifySubmittedReceipt949();
console.log(
  JSON.stringify(
    {
      schema: "spondee.g3-submitted-job-949-chain-proof.v1",
      network: "bsc-testnet",
      chain_id: 97,
      job_id: result.job.id.toString(),
      status: Number(result.job.status) === 3 ? "COMPLETED" : "SUBMITTED",
      provider_address: result.job.provider,
      submit_transaction_hash: result.receipt.transactionHash,
      submit_block: result.receipt.blockNumber.toString(),
      deliverable_url: result.deliverableUrl,
      deliverable_hash: result.job.deliverable,
      promise_id: result.commitment.promiseId,
      promise_sha256: result.commitment.promiseSha256,
      scenario_id: result.commitment.scenarioId,
      receipt_log_scan_used: false,
      secrets_printed: false,
      conclusion: "SPONDEE_G3_JOB_949_CHAIN_RECEIPT_PROOF_PASS",
    },
    null,
    2,
  ),
);
