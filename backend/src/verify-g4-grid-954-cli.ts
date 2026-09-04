import { verifyGrid954LocalManifestAndReceipt } from "./verify-g4-grid-954.js";

async function main(): Promise<void> {
  if (process.env.SPONDEE_G4_GRID_954_ENTRYPOINT_SMOKE === "1") {
    console.log("SPONDEE G4 GRID 954 CLI ENTRYPOINT: PASS");
    return;
  }

  const result = await verifyGrid954LocalManifestAndReceipt();
  console.log(JSON.stringify(result, null, 2));
  console.log("SPONDEE G4 GRID JOB 954 VERIFICATION: PASS");
}

main().catch((error: unknown) => {
  const failure = {
    schema: "spondee.g4-grid-job-954-verification.failure.v1",
    network: "bsc-testnet",
    chain_id: 97,
    category: "grid",
    provider_address: "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8",
    job_id: "954",
    submit_transaction_hash: "0xf279d0f3b215ed6b92449fcaf93517a42f7c309190ab923aabd010d034a0e6f3",
    error: error instanceof Error ? error.message : String(error),
    secrets_printed: false,
    conclusion: "SPONDEE_G4_GRID_JOB_954_RECEIPT_VERIFICATION_FAIL_CLOSED",
  };
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
});
