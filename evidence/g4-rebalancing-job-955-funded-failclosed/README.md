# Spondee G4 — Rebalancing job 955 FUNDED fail-closed evidence

Date: 2026-09-04 UTC
Category: Rebalancing
Network: BSC Testnet (`chain_id=97`)

## Human-local run

The isolated Rebalancing live runner created and funded job `955` at zero service price through MegaFuel, then failed closed before provider submit verification because the buyer incorrectly required the default asynchronous `notify_funded` ACK to contain `ok:true`.

Public transaction evidence:

- provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- buyer: `0xbe9775807767c36A2ae4c2b88c1Fc08722273D37`
- task schema: `spondee.rebalancing.task.v1`
- scenario: `spondee-rebalancing-live-001`
- CREATE_JOB: `0x91be2b383238e90ed206859f8da57262331459dd8cf5a2c3db158d836d0c9615`
- REGISTER_JOB: `0xbaa83e00fc05b636401d1ffed6586d04a537cdd764c792c6cca5830b105facee`
- SET_BUDGET: `0x2aedd782b65ae6b531071e1c34da8b32f55c94570dcf47b58641778890467129`
- FUND: `0xa82b4eababc631cc8af66dfa2f35fd88a04d53c7306f143314ca3ed470340e16`
- buyer error: `seller notify_funded did not return ok=true`

The runner stopped immediately. Yield remained blocked. No blind retry occurred.

## Deterministic diagnosis

The Agent Studio seller's default `notify_funded` behavior is asynchronous. It returns `status:"accepted"` after the funded-job verification and then performs work/provider submit in a background task. Requiring `ok:true` in the immediate A2A response was therefore a buyer-contract error.

The seller audit line with `tx_hash:null` represented the start of `8183_submit_work`; it was not proof that a provider submit transaction had landed.

## Read-only chain probe

GitHub Actions run `33840042425` performed a wallet-free, write-free `getJob(955)` probe and passed.

Observed state:

- job id: `955`
- status: `FUNDED` (`status_code=1`)
- submitted_at: `0`
- deliverable hash: zero
- budget: `0`
- buyer balance: `0 wei`
- correct provider, buyer, task schema and scenario
- chain_write_attempted: `false`
- wallet_used: `false`

Conclusion: `SPONDEE_G4_REBALANCING_JOB_955_READ_ONLY_FUNDED_PROBE_PASS`.

This proves no provider submit was mined after the failed buyer process. Job 955 is therefore the only valid Rebalancing recovery target; creating a replacement job is forbidden until 955 is resolved.

## Recovery preflight

Run `33840652210` — PASS.

The recovery implementation:

- preserves default asynchronous Agent Studio behavior;
- adds explicit Spondee bounded opt-in `wait_for_result:true` for controlled local proof;
- uses the exact returned provider submit tx receipt;
- performs no historical JobSubmitted log scan;
- contains no `createJob`, `registerJob`, `setBudget`, or `fund` operation;
- is pinned to job `955`;
- preserves buyer zero-balance and `SIMULATION` truth boundaries.

## Truth boundary

No observed Agent Advantage is claimed. No mainnet or user capital was used. The Rebalancing Outcome Receipt remains pending until job 955 provider submit + manifest/receipt recovery passes.
