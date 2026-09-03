# Spondee MegaFuel Smoke Evidence 001

Date: 2026-09-03
Branch: `build/backend-complete`
Evidence class: `BSC_TESTNET_INFRASTRUCTURE_PROBE`

## Result

GitHub Actions run: `33802027942`
Verified head: `c8fc6e3cbeedb88134749cedc79890bd912883c9`
Conclusion: **SUCCESS**

Artifact:
- ID: `9911428783`
- name: `spondee-megafuel-smoke-evidence`
- digest: `sha256:1c8e893c796a0e0ba8cac320b7b13b42baabdb265eae5794b2cb2b16089aaa94`

## What was proven

A newly generated in-memory EVM wallet with **0 tBNB** executed two successful ERC-8183 BSC Testnet writes through the SDK with MegaFuel/paymaster explicitly enabled:

1. `createJob(...)`
2. `cancelOpen(jobId)`

The wallet balance was `0 wei` before the writes and `0 wei` after the writes. Both transactions returned status `1` and mined transaction hashes. Therefore the test proves an actual zero-balance sponsored ERC-8183 write path on BSC Testnet for the pinned Spondee SDK runtime.

## Evidence values

```text
network = bsc-testnet
chain_id = 97
paymaster_enabled = true
paymaster_url_configured = true
ephemeral_client_address = 0x6582Fe02B03a4E345A4e7597F4B1264d044f3026
balance_before_wei = 0
balance_after_wei = 0
provider_address = 0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8
job_id = 942
create_job_tx = 0x1017e9f592bd84e9d433ad311f473e2e92bc24260c7a6d7e464970ae1f0f6f85
cancel_open_tx = 0x893899a7d4c8c5b905765e2f3aada4be82cf3e0f8096f5c5fe73a8589616337c
create_status = 1
cancel_status = 1
```

## Secret-handling boundary

- private key generated only in memory;
- `persist: false`;
- private key never printed;
- no GitHub secret required;
- no mainnet action;
- no user funds;
- the zero-value probe job was cancelled after creation.

## What this does NOT prove

This smoke does **not** yet prove the complete Spondee Health Factor E2E. It does not contain:
- a seller-signed Spondee Promise Card quote;
- `registerJob` / `setBudget(0)` / `fund(0)` from the dedicated buyer path;
- `notify_funded` to the specialized Health Factor seller endpoint;
- seller-side `submit` of the Outcome Receipt;
- deliverable manifest verification against the on-chain hash;
- observed Agent Advantage.

## Operational conclusion

MegaFuel is no longer merely an SDK capability hypothesis for Spondee. It is **runtime-proven for zero-balance ERC-8183 writes on BSC Testnet**.

tBNB remains a fallback for relay/runtime instability, not a prerequisite for attempting the next bounded Health Factor live E2E.

## Next exact gate

`SPONDEE_G3_MEGAFUEL_BACKED_HEALTH_FACTOR_LIVE_E2E`
