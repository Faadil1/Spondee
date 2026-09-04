# Spondee G4 — Sequential Live Testnet E2E Gate

Date: 2026-09-04 UTC
Gate: `SPONDEE_G4_THREE_CATEGORY_SEQUENTIAL_LIVE_TESTNET_E2E_REQUIRED`
Human gate status: `AUTHORIZED`

## Authorization

The human explicitly opened this gate in the project conversation by naming `SPONDEE_G4_THREE_CATEGORY_SEQUENTIAL_LIVE_TESTNET_E2E_REQUIRED` after the controlled three-agent build/CI and multi-category buyer preflight had passed.

This authorization is bounded to the following sequence:

1. Grid Trading
2. Rebalancing
3. Yield Optimisation

The sequence is fail-closed. Rebalancing MUST NOT start unless Grid passes. Yield MUST NOT start unless Rebalancing passes. Any failure stops the runner and requires deterministic diagnosis before another write attempt.

## Preconditions already satisfied

- G4 three-reference-agent CI: `33826331454` — PASS.
- Grid, Rebalancing and Yield Agent Studio workspaces: build/test/`bag scan` PASS.
- Multi-category ERC-8183 buyer driver: backend CI `33826671823` — PASS.
- BSC testnet/Commerce contract read-only probe: PASS.
- Health Factor G3 canonical seller wallet exists locally and is encrypted.
- MegaFuel zero-balance pattern was previously proven through provider submit on job 949.

## Allowed in this gate

- BSC Testnet chain 97 only.
- Canonical seller provider `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`.
- Local unlock of the existing encrypted seller wallet through a masked prompt.
- One bounded zero-price ERC-8183 lifecycle per category: createJob -> registerJob -> setBudget(0) -> fund(0) -> provider submit -> manifest/Outcome Receipt verification.
- MegaFuel as the primary gas path.
- Ephemeral zero-balance buyer wallets created and destroyed locally.
- Local HTTP delivery bridge so the deliverable is fetchable during verification.
- Public transaction hashes/job IDs/Promise IDs/receipt evidence may be recorded.

## Forbidden / still protected

- no new seller wallet;
- no password/private key/seed/keystore content in chat, logs or Git;
- no BSC mainnet or meaningful user capital;
- no non-zero service price;
- no x402/B402 payment;
- no Altana grantSession;
- no PancakeSwap/Venus/Lista value-moving transaction;
- no observed Agent Advantage claim from these declared simulations;
- no merge to main;
- no Project Finisher;
- no final hackathon submission.

## Truth boundary

The transport and ERC-8183 lifecycle may be live on BSC Testnet, but the category scenarios remain declared `SIMULATION` inputs. A successful live transport proof does not become observed market-performance evidence and remains excluded from observed Agent Advantage.

## Current status

`AUTHORIZED__RUNNER_AND_PREFLIGHT_BUILD_IN_PROGRESS__NO_NEW_G4_CHAIN_WRITE_YET`

Exact next executable after CI PASS:

`powershell -ExecutionPolicy Bypass -File .\scripts\g4-sequential-live-e2e-localstorage.ps1`
