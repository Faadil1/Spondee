# Spondee G4 — Yield isolated live runner preflight

Date: 2026-09-04 UTC
Scope: Yield-only BSC-testnet execution preparation

## Result

Authoritative GitHub Actions run: `33841526082` — **PASS**.

Validated on head `b57bd35ba4fd6d77993c035c7ca3e33e83cef4a7`:

- backend regression suite: PASS
- backend strict TypeScript: PASS
- exact `wait_for_result: true` submit-receipt contract: PASS
- historical `getJobSubmittedEvents` path absent: PASS
- Yield category agent tests: PASS
- Yield bounded sync notify tests: PASS
- Yield strict TypeScript build: PASS
- Yield scenario schema/id/truth class: PASS (`SIMULATION`)
- Windows PowerShell parse: PASS
- Yield-only category pin: PASS
- no Grid scenario path: PASS
- no Rebalancing scenario path: PASS
- prior jobs 949/954/955 closure guard: PASS
- no seller wallet creation command: PASS
- no mainnet target: PASS

## Runner

`scripts/g4-yield-live-e2e-localstorage.ps1`

The runner may create only a new Yield testnet job through the existing bounded G4 live driver. It must not touch Health Factor job 949, Grid job 954, or Rebalancing job 955.

## Runtime boundaries

- BSC Testnet only
- zero service price
- MegaFuel primary
- zero-balance ephemeral buyer required
- existing canonical seller wallet only
- masked local password prompt only
- stop on first failure
- no blind retry after partial chain write
- no tBNB acquisition fallback without a new explicit gate
- no x402/B402 payment
- no mainnet or meaningful user capital
- no merge to main
- no final submission

## Truth boundary

The Yield scenario and resulting Outcome Receipt remain `SIMULATION`. A successful live run will prove live activation transport and Promise-to-Receipt binding, not observed Agent Advantage or observed investment performance.