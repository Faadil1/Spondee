# G5 Grid forward pre-write size fail-closed remediation

Date: 2026-09-04

## Initial authorized execution attempt

Gate: `SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_EXECUTION_REQUIRED`

The human-local runner reached Promise/quote construction but failed **before any BSC-testnet write**.

Public failure facts:

- schema: `spondee.g5-grid-forward-observed-pair.failure.v1`
- provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- ephemeral buyer: `0x85aDE49c28dDCE4140485153EC7d835a620278de`
- progress: `[]`
- error: `on-chain description is 2288 bytes, exceeds max_length=1600; shorten task_description / terms. Truncating would invalidate negotiation_hash / provider_sig.`
- mainnet value moved: false
- secrets printed: false
- conclusion: `SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_FAIL_CLOSED`

Because progress was empty, no create/register/setBudget/fund/submit transaction was attempted and no G5 Grid job was created. The one-new-job human authorization was therefore **not consumed**.

## Root cause

The V1 task carrier base64-encoded the full verbose canonical task JSON, including constants already implied by the schema. The prior preflight checked task validity but did not enforce a byte budget for the signed on-chain ERC-8183 description.

## Deterministic remediation

A compact V2 carrier `SG5F2:` now transports only the variable task fields. Backend and seller reconstruct the exact same canonical `spondee.grid-forward-observed.task.v1` before Promise generation/execution. Legacy V1 decode remains supported.

New guards:

- backend compact carrier roundtrip test;
- compact carrier must remain `<500` bytes;
- seller compact carrier reconstruction tests;
- strict backend and seller TypeScript builds;
- workflow validates live read-only preflight byte budget;
- existing execution gate/no-mainnet-write/Windows protections remain active.

Authoritative remediation CI:

- run: `33859221865`
- head: `e608c81f34ef2e8442d53efbe946ab84f1515829`
- backend-forward-contract: PASS
- grid-forward-seller: PASS
- windows-runner-safety: PASS

## Truth boundary

- no G5 job was created by the failed attempt;
- no BSC-testnet transaction was attempted by the failed attempt;
- no mainnet value moved;
- countable observed pairs remain `0/3`;
- execution authorization remains bounded to exactly one future new G5 Grid BSC-testnet job;
- no blind retry is permitted outside the remediated, CI-validated head.

Conclusion: `SPONDEE_G5_GRID_FORWARD_PREWRITE_SIZE_FAILCLOSED_REMEDIATED`
