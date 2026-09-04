# Spondee G4 — Yield job 957 final PASS

Date: 2026-09-04 UTC
Category: Yield Optimisation
Network: BSC Testnet (chain 97)
Provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`

## Result

`SPONDEE_G4_YIELD_MEGAFUEL_LIVE_E2E_PASS`

The isolated Yield-only runner completed the full bounded Spondee live transport path for job `957`.

## Public chain/runtime evidence

- buyer: `0xa9C2A1397F7E5901Af2BB8C40CC9acEdC5aeD770`
- buyer balance before: `0 wei`
- buyer balance after: `0 wei`
- service price: `0`
- gas path: MegaFuel primary
- task schema: `spondee.yield.task.v1`
- scenario: `spondee-yield-live-001`
- CREATE_JOB: `0xa62ec234e3d1d348a56b72fd0974f229c73371787ccc8148f251aab54a5610bd`
- REGISTER_JOB: `0xcc674932bff4f0842e9078642c77c29f4af8b97eb8b2d9665c9d9ffb8264eb16`
- SET_BUDGET: `0x649ec3dce10b4184f2288db5c6538dff7de6074c124e45eed18e324087fb1d7e`
- FUND: `0xf4b07f73f023922d9560e536710eb956e0fb6be16d514434f630b972eb31455a`
- provider SUBMIT: `0x35de5f07749c3d0cc6471b20272100b8eeb8b3424a62ecee357904ddfb8800f7`
- final observed chain status during runner: `SUBMITTED`
- deliverable URL: `http://127.0.0.1:9100/erc8183/job/957/response`
- promise ID: `sp_54d1d6a04418f5a2f4e5c79c`
- promise SHA-256: `3aae9cea505146218d1c3518e625b885983a043ff20635ae08f64beab3a204d6`
- job description bytes: `1255`
- manifest hash verified: `true`
- Spondee Outcome Receipt verified: `true`
- historical JobSubmitted log scan used: `false`
- buyer private key persisted after run: `false`
- buyer private key printed: `false`

## Outcome Receipt truth boundary

The receipt is explicitly `SIMULATION` evidence. It proves deterministic Promise-to-Outcome plumbing for the declared Yield inputs only.

It does **not** prove observed market performance, realized yield, profit, or Agent Advantage. The receipt itself records `eligible_for_observed_agent_advantage=false`, and no observed Agent Advantage claim is made.

## G4 closure

With Health Factor job `949`, Grid job `954`, Rebalancing job `955`, and Yield job `957`, Spondee now has verified bounded live BSC-testnet transport across all four required categories.

This closes the four-category live-transport gate. The remaining critical evidence gap is the PRD requirement for at least three **observed paired Agent Advantage tasks**, including at least one trading-related task, plus public judge-accessible deployment.
