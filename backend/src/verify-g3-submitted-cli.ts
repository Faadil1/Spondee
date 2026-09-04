import { verifySubmittedJob949 } from "./verify-g3-submitted.js";

const CANONICAL_PROVIDER = "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8";
const TARGET_JOB_ID = "949";
const TARGET_SUBMIT_TX = "0x39243a3e3b145e31cd6318ace98ca764028a91e1a68d5f89f7fdc556d4b4fc74";
const PASS_TERMINAL = "SPONDEE G3 SUBMITTED JOB 949 VERIFICATION: PASS";
const ENTRYPOINT_SMOKE_TERMINAL = "SPONDEE G3 SUBMITTED JOB 949 CLI ENTRYPOINT: PASS";

async function main(): Promise<void> {
  if (process.env.SPONDEE_G3_VERIFY_ENTRYPOINT_SMOKE === "1") {
    console.log(ENTRYPOINT_SMOKE_TERMINAL);
    return;
  }

  try {
    const result = await verifySubmittedJob949();
    console.log(JSON.stringify(result, null, 2));
    console.log(PASS_TERMINAL);
  } catch (error) {
    const failure = {
      schema: "spondee.g3-submitted-job-verification.failure.v1",
      network: "bsc-testnet",
      chain_id: 97,
      provider_address: CANONICAL_PROVIDER,
      job_id: TARGET_JOB_ID,
      submit_transaction_hash: TARGET_SUBMIT_TX,
      error: error instanceof Error ? error.message : String(error),
      secrets_printed: false,
      conclusion: "SPONDEE_G3_SUBMITTED_JOB_949_RECEIPT_VERIFICATION_FAIL_CLOSED",
    };
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  }
}

void main();
