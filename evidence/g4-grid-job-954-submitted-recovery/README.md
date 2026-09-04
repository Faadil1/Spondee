# Spondee G4 — Grid job 954 submitted / read-only recovery required

Date: 2026-09-04 UTC
Gate: `SPONDEE_G4_THREE_CATEGORY_SEQUENTIAL_LIVE_TESTNET_E2E_REQUIRED`
Category: Grid
Result of first sequential live run: **CHAIN SUBMIT CONFIRMED / RUNNER FAIL-CLOSED POST-SUBMIT**

## Public runtime evidence

- job id: `954`
- network: BSC Testnet (`chain_id=97`)
- provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- ephemeral buyer: `0xaCFe38292DdFC028CD3D9e1900B590Ef8C99c3a1`
- task: `spondee.grid.task.v1`
- scenario: `spondee-grid-live-001`
- service price/budget: `0`
- receipt truth class remains `SIMULATION`
- observed Agent Advantage claimed: `false`
- secrets printed: `false`

Transactions observed by the buyer:

- create job: `0x6d6b54e9d1c591e4d5fa749cbb5447aa90f25bcac2e0a5d33a03af265aa4a72e`
- register job: `0xa33afe6deb28eb131f6b13f0ece91cb8b66b56322be505229da3e87ff9ae9713`
- set budget: `0x3c1a6ce970d2afd65ce4faa77af28dcbbc4db2fdb428c87a6f34bf617e8a9ed1`
- fund: `0x88eef4c03e7caee0b531aeea5b9e4de978aab03dcc9785a5870d6badb2b881d0`

Seller audit additionally proves provider submission:

- submit tx: `0xf279d0f3b215ed6b92449fcaf93517a42f7c309190ab923aabd010d034a0e6f3`
- submit status: confirmed
- gas used: `235315`
- effective gas price: `0 wei`
- wallet paid: `0 wei`
- deliverable URL: `http://127.0.0.1:9100/erc8183/job/954/response`
- local manifest: `reference-agents/grid/app/agent/.agent-data/erc8183-job-954.json`

## Failure class

The sequential buyer failed **after provider submission** while trying to discover `JobSubmitted` with a bounded `eth_getLogs` scan. The BSC testnet RPC returned `limit exceeded` / `Request exceeds defined limit`.

This is the same failure family previously encountered after G3 job 949. It is not evidence that the provider failed to submit.

Root cause in the G4 buyer path: after `notify_funded`, the seller response containing the confirmed submit transaction was ignored, and the buyer later called `commerce.getJobSubmittedEvents(fundBlock, latestBlock, jobId)`. That scan is unnecessary when the submit transaction hash is already known.

## Recovery rule

**DO NOT RETRY JOB 954.**

No new seller wallet, password prompt, tBNB acquisition, new job, new funding, or new provider submission is required for recovery.

Recovery must be read-only:

1. read the known submit transaction receipt directly;
2. decode `JobSubmitted(954)` and `JobInitialised(954)` from that receipt;
3. read `getJob(954)` directly;
4. verify provider/client/status/zero budget/deliverable;
5. serve the already-created local manifest through the local HTTP bridge;
6. verify manifest hash against the on-chain deliverable;
7. verify the Spondee Outcome Receipt against the signed Promise/scenario;
8. preserve `SIMULATION` and `observed_agent_advantage_claimed=false`.

Implementation:

- `backend/src/verify-g4-grid-954.ts`
- `backend/src/verify-g4-grid-954-cli.ts`
- `backend/src/probe-g4-grid-954.ts`
- `scripts/g4-verify-grid-job-954.ps1`

Rebalancing and Yield remain blocked until this read-only Grid recovery reaches PASS.
