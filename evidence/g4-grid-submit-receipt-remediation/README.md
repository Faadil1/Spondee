# Spondee G4 — Direct provider submit receipt remediation

Date: 2026-09-04 UTC
Scope: Grid failure diagnosis + Rebalancing/Yield prevention

## Trigger

Grid job `954` reached provider submit successfully, but the buyer process then failed because `backend/src/category-erc8183.ts` ignored the exact submit transaction returned by the seller `notify_funded` response and instead called `getJobSubmittedEvents`, which invoked `eth_getLogs` over a block range. The BSC Testnet RPC rejected the request with `limit exceeded`.

No Grid write was retried.

## Remediation

The G4 live buyer now:

1. validates the `notify_funded` response;
2. requires the exact expected job ID;
3. requires a valid provider submit transaction hash;
4. calls `getTransactionReceipt` on that exact transaction;
5. decodes `JobInitialised` from the known receipt;
6. compares the receipt deliverable URL with the seller response when present;
7. performs no `getJobSubmittedEvents` scan.

`parseNotifyFundedSubmit` has positive and negative unit tests.

## CI invariant

The G4 Sequential Live Preflight now fails if `backend/src/category-erc8183.ts` contains `getJobSubmittedEvents`.

Authoritative remediation run: `33839234808` — PASS.

Validated:
- backend unit/integration tests: PASS
- strict TypeScript build: PASS
- direct notify_funded submit receipt invariant: PASS
- Grid/Rebalancing/Yield scenarios: PASS
- credential-free live gate remains fail-closed: PASS
- Grid/Rebalancing/Yield reference agents: PASS
- Windows runner parse: PASS

## Rebalancing isolation

A dedicated `scripts/g4-rebalancing-live-e2e-localstorage.ps1` was added so Grid job 954 cannot be recreated by re-running the original sequential runner.

Authoritative isolated-runner preflight: `33839458498` — PASS.

Windows CI verifies:
- PowerShell parses;
- category is pinned to `rebalancing`;
- no Grid scenario path;
- no Yield scenario path;
- no seller wallet creation;
- no mainnet target;
- explicit Grid job 954 closure guard.

## Truth boundary

This remediation changes transport verification only. It does not create observed Agent Advantage evidence and does not upgrade any SIMULATION receipt to observed market performance.
