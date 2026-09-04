# Spondee G4 — Rebalancing job 955 final PASS

Date: 2026-09-04 UTC
Network: BSC Testnet (chain 97)
Category: Rebalancing

## Result

`SPONDEE_G4_REBALANCING_JOB_955_RECOVERY_PASS`

The bounded recovery resumed the existing FUNDED ERC-8183 job `955`. It did **not** create, register, budget, or fund another job.

## On-chain identity

- Provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- Buyer: `0xbe9775807767c36A2ae4c2b88c1Fc08722273D37`
- Buyer balance before: `0 wei`
- Buyer balance after: `0 wei`
- Job: `955`
- Final observed status: `SUBMITTED`
- Task schema: `spondee.rebalancing.task.v1`
- Scenario: `spondee-rebalancing-live-001`
- Service price: `0`

## Transactions

- CREATE_JOB: `0x91be2b383238e90ed206859f8da57262331459dd8cf5a2c3db158d836d0c9615`
- REGISTER_JOB: `0xbaa83e00fc05b636401d1ffed6586d04a537cdd764c792c6cca5830b105facee`
- SET_BUDGET: `0x2aedd782b65ae6b531071e1c34da8b32f55c94570dcf47b58641778890467129`
- FUND: `0xa82b4eababc631cc8af66dfa2f35fd88a04d53c7306f143314ca3ed470340e16`
- PROVIDER SUBMIT: `0xb69e799bb8668eb93c9d724e42fd3351e13b10a75c22b7236eb58ed680cf3149`
- Submit block: `129008551`
- Submitted at: `1788500356`

## Promise / deliverable

- Promise ID: `sp_034fd69c69975ffa9a5b916f`
- Promise SHA-256: `8fe7607d75b86a924d14e0a63dccfaf40b16119d535c450caa99781194f225b3`
- Deliverable URL: `http://127.0.0.1:9100/erc8183/job/955/response`
- Deliverable hash: `0x2c0341870da9ba1a03cb80130ba3de7852873ae6274396aa4141d591cef80a3c`
- Manifest hash verified: `true`
- Spondee Outcome Receipt verified: `true`

## Recovery invariants

- Read-only precheck proved job 955 was still FUNDED before wallet unlock.
- Existing job 955 only.
- `new_job_created_during_recovery=false`.
- No historical `eth_getLogs` discovery was used.
- Exact provider submit transaction receipt was used.
- MegaFuel boundary preserved; buyer remained at zero balance.
- No Grid or Yield write occurred.
- No secret was printed.

## Truth boundary

The receipt is `SIMULATION` evidence. This proves live BSC-testnet activation transport and Promise-to-Receipt binding for Rebalancing. It does **not** prove observed Agent Advantage, observed yield/trading performance, or mainnet/user-capital execution.

## Closure

Rebalancing G4 live activation is closed PASS on job 955. Do not recreate or mutate Rebalancing job 955. Yield may advance only through its separate isolated gate.