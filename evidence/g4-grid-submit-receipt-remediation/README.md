# Spondee G4 — Provider submit receipt remediation history

Date: 2026-09-04 UTC
Scope: Grid 954 recovery history + Rebalancing/Yield transport correction

## Grid trigger

Grid job `954` reached provider submit successfully, but the buyer then called `getJobSubmittedEvents`, which invoked `eth_getLogs` over a block range. The BSC Testnet RPC rejected that scan with `limit exceeded`.

No Grid write was retried. Grid was recovered read-only from its already-known provider submit transaction and later closed PASS.

## Important correction discovered by Rebalancing 955

The first post-Grid remediation assumed the A2A `notify_funded` response synchronously contained `{ok:true, tx_hash, deliverable_url}`. That assumption was incorrect for the default Agent Studio seller contract.

The actual default seller behavior is intentionally asynchronous:

1. verify the funded job enough to ACK;
2. return `{status:"accepted", job_id, ...}` immediately;
3. execute work and provider submit in a background task;
4. log the eventual `{ok:true, tx_hash, deliverable_url}` internally.

The `ok:true` object observed in Grid seller stdout was the background completion log, not the A2A response.

Rebalancing job `955` exposed this mismatch: the buyer received the correct asynchronous `status:"accepted"` ACK but the temporary parser required `ok:true`, so it failed closed immediately after FUND. A later read-only probe proved job 955 remained `FUNDED`; no provider submit was mined during that failed attempt.

## Final bounded Spondee transport

The default Agent Studio asynchronous contract remains unchanged.

For Spondee's bounded local G4 proof only, Rebalancing and Yield sellers now support an explicit opt-in field:

`wait_for_result: true`

When this opt-in is present, the seller:

1. verifies the named funded job;
2. runs the existing fixed-code work + submit path;
3. waits within a bounded timeout;
4. returns the exact terminal `{ok:true, job_id, tx_hash, deliverable_url}` result.

The buyer then reads that exact transaction receipt directly and decodes `JobInitialised`. It performs no `getJobSubmittedEvents` historical scan.

The generic G4 buyer explicitly sends the bounded opt-in for future controlled live proof. The default seller behavior for ordinary callers remains asynchronous.

## Verification

Grid read-only recovery CI: `33828319822` — PASS.

Intermediate direct-receipt CI: `33839234808` — PASS as code/tests, but its assumption about the *default* `notify_funded` response was later superseded by the Rebalancing 955 diagnosis above.

Rebalancing 955 read-only status probe: `33840042425` — PASS, showing:
- job `955` = `FUNDED`;
- submitted_at = `0`;
- deliverable hash = zero;
- buyer balance = `0 wei`;
- no wallet and no chain write used by the probe.

Final bounded-sync recovery preflight: `33840652210` — PASS, validating:
- backend tests and strict TypeScript build;
- explicit `wait_for_result:true` buyer contract;
- default async ACK is not mistaken for terminal submit;
- Rebalancing and Yield bounded-sync seller tests/builds;
- no `getJobSubmittedEvents` in the G4 buyer;
- job 955 recovery code contains no `createJob`, `registerJob`, `setBudget` or `fund` primitive;
- Windows recovery runner parses and is pinned to existing job 955.

## Truth boundary

This is transport/runtime evidence only. All Spondee Outcome Receipts in this workstream remain `SIMULATION` unless separately proven otherwise. No observed Agent Advantage or real trading performance is created by this remediation.
