# Spondee G5 — Grid Forward Observed Pair Runner Preflight

Date: 2026-09-04 UTC
Gate: `SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_RUNNER_AND_PREFLIGHT_REQUIRED`
Result: **PASS**

## Authoritative CI

- Run: `33857461378`
- Head: `19cdf217e9b579dc8c114bedfe742ef500273bff`
- `backend-forward-contract`: PASS
- `windows-runner-safety`: PASS

Validated:

- full backend regression tests;
- strict TypeScript build;
- forward-specific no-lookahead/countability tests;
- read-only Chainlink BNB/USD anchor generation;
- generated marketplace task contains exactly two identical anchor-price points and no future market path;
- `countable_before_execution=false`;
- wallet not used in preflight;
- chain write not attempted in preflight;
- user capital not used;
- PowerShell runner parses on Windows;
- exact one-run execution authorization guard appears before the wallet prompt.

## Implementation

- `backend/src/g5-grid-forward-observed.ts`
- `backend/src/g5-grid-forward-observed.test.ts`
- `scripts/g5-grid-forward-observed-pair.ps1`
- `.github/workflows/g5-grid-forward-observed-runner-preflight.yml`

## Forward protocol

1. Read current Chainlink BNB/USD anchor on BNB Chain mainnet **read-only**.
2. Freeze pair/scenario/grid parameters from that anchor only.
3. Generate a zero-price BSC-testnet marketplace task with no future price path.
4. Execution remains sealed unless the later human gate supplies the exact one-run authorization token.
5. After a successful marketplace activation, the future observation window starts only after provider submit/activation completion.
6. Collect at least 12 Chainlink rounds strictly after activation completion.
7. Evaluate frozen Grid strategy and without-agent 50/50 baseline on the exact same forward rounds.
8. Preserve input, market data, agent output, baseline output, timing, cost and BSC-testnet transaction tape.
9. Only then may `spondee.agent-advantage-pair.v1` become countable.

## Truth boundary

This preflight created **zero countable Agent Advantage pairs** and performed **zero chain writes**.

The historical Grid dry-run remains non-countable. Closed jobs `949`, `954`, `955`, and `957` remain closed and must not be reused.

Mainnet is read-only only. No user capital or realized-mainnet-PnL claim is authorized.

## Next gate

`SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_EXECUTION_REQUIRED`

That gate may authorize exactly one new zero-price BSC-testnet Grid marketplace activation for a newly frozen forward scenario. It remains human-owned because it performs protected external writes.
