# Spondee G3 — Job 949 read-only CLI fix

Date: 2026-09-04

## Incident

Two human-local executions of `scripts/g3-verify-submitted-job-949.ps1` on Windows reached:

`==> Verifying known submit transaction + job 949 + manifest + Outcome Receipt`

and then exited silently with code 0, without emitting either the required PASS block or a failure block.

This was **not** a verification PASS and did **not** create or modify any on-chain state.

## Root cause

`backend/src/verify-g3-submitted.ts` used a hand-built direct-execution guard comparing `import.meta.url` with `file://${process.argv[1]...}`. On Windows, the generated URL shape did not match the canonical `file:///C:/...` URL, so `verifySubmittedJob949()` was never invoked. Node therefore exited 0 with no output.

The PowerShell wrapper checked only `$LASTEXITCODE`, so the silent no-op was not rejected.

## Remediation

1. Added `backend/src/verify-g3-submitted-cli.ts` as a dedicated cross-platform CLI that always invokes the verifier when called.
2. `scripts/g3-verify-submitted-job-949.ps1` now calls that CLI.
3. The wrapper captures verifier output and requires the exact terminal:

`SPONDEE G3 SUBMITTED JOB 949 VERIFICATION: PASS`

A zero exit code without that terminal now fails closed.
4. Added Ubuntu and Windows Node 24 CLI-entrypoint smoke checks to `.github/workflows/g3-submitted-949-verification.yml`.

## Validation

GitHub Actions run: `33823556651`

Result: **PASS**

Verified:
- Ubuntu CLI entrypoint smoke: PASS
- Backend regression suite: PASS
- Strict TypeScript build: PASS
- Receipt-based job 949 chain proof: PASS
- Windows PowerShell parse: PASS
- Windows Node 24 CLI entrypoint smoke: PASS

## Chain safety

No new job was created.
No seller wallet was unlocked.
No transaction was broadcast.
Job 949 remains already SUBMITTED.
Job 948 remains terminal and non-retryable.
Current gate remains read-only local manifest + Outcome Receipt verification only.
