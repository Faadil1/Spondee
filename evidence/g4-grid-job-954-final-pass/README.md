# Spondee G4 — Grid job 954 final PASS

Date: 2026-09-04 UTC
Category: Grid Trading
Scenario: `spondee-grid-live-001`
Network: BSC Testnet (chain 97)

## Conclusion

**PASS** — Spondee Grid completed the bounded live BSC-testnet transport path through provider submit and the existing local deliverable was independently verified against the on-chain deliverable hash.

This closes the Grid slice for the G4 sequential live-testnet gate.

## Chain evidence

- Job ID: `954`
- Final observed job status during local verifier: `COMPLETED`
- Provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- Buyer: `0xaCFe38292DdFC028CD3D9e1900B590Ef8C99c3a1`
- CREATE_JOB: `0x6d6b54e9d1c591e4d5fa749cbb5447aa90f25bcac2e0a5d33a03af265aa4a72e`
- REGISTER_JOB: `0xa33afe6deb28eb131f6b13f0ece91cb8b66b56322be505229da3e87ff9ae9713`
- SET_BUDGET: `0x3c1a6ce970d2afd65ce4faa77af28dcbbc4db2fdb428c87a6f34bf617e8a9ed1`
- FUND: `0x88eef4c03e7caee0b531aeea5b9e4de978aab03dcc9785a5870d6badb2b881d0`
- PROVIDER SUBMIT: `0xf279d0f3b215ed6b92449fcaf93517a42f7c309190ab923aabd010d034a0e6f3`
- Submit block: `128979779`
- Submitted at: `1788487408`
- Service price: `0`
- Seller submit gas effective price observed in runtime: `0 wei`

## Promise / deliverable binding

- Promise ID: `sp_2bd9d0cfdf390f09ddafd8a0`
- Promise SHA-256: `30b221979b30d33a006ec1fe42cb2a70a92f311c00ca2542086826937680ccb0`
- Deliverable URL: `http://127.0.0.1:9100/erc8183/job/954/response`
- Deliverable hash: `0x60d6559e9d8e9f5c6982cbe427d0f42538d7086508f5c30d3ac550292f33d26f`
- Manifest hash verified: `true`
- Spondee Outcome Receipt verified: `true`
- Receipt log scan used: `false`

## Recovery path

The first Grid buyer process failed after the provider had already submitted the job because it ignored the submit transaction returned by `notify_funded` and then attempted a bounded `eth_getLogs` scan via `getJobSubmittedEvents`. The BSC Testnet RPC rejected that scan with `limit exceeded`.

No live write was retried.

A receipt-based read-only recovery then:

1. used the known provider submit transaction `0xf279...e6f3`;
2. decoded the submit receipt directly;
3. verified the on-chain job and deliverable hash;
4. started only the local HTTP manifest bridge;
5. verified the existing manifest and Spondee Outcome Receipt.

Read-only recovery CI: `33828319822` — PASS, including Windows Node 24 CLI execution.

Human-local terminal:

`SPONDEE G4 GRID JOB 954 VERIFICATION: PASS`

## Truth boundary

- Live ERC-8183/BSC-testnet activation and provider submit evidence: **LIVE_CHAIN VERIFIED**.
- Outcome Receipt evidence class: **SIMULATION**.
- Observed Agent Advantage claimed: **false**.
- This result does **not** count toward the required observed Agent Advantage experiments.
- This result does **not** prove observed trading PnL or observed market performance.
- The loopback deliverable URL is not yet a public judge-accessible deployment.

## Retry rule

Job `954` is closed for write execution. **Do not recreate, refund, resubmit, or blindly retry it.**
