# Spondee G5 — Grid Forward Observed Pair Runner Preflight

Date: 2026-09-04 UTC
Gate: `SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_RUNNER_AND_PREFLIGHT_REQUIRED`
Result: **PASS**
Authoritative workflow run: **33845758154**
Validated runtime head: `c59725553793e6927479077205d4e4a91a7e78bb`
Branch: `build/g5-grid-forward-observed`

## What is now implemented

A separate G5 Grid forward-observation path exists without modifying or reopening the closed G4 Grid job 954.

The path freezes a dedicated `spondee.grid-forward-observed.task.v1` and deterministic Promise before any future observation. A later protected execution may create exactly one new zero-price BSC-testnet ERC-8183 marketplace job. The Grid seller then begins its observed-data collection only after the funded marketplace job reaches `notify_funded`.

The seller accepts only future Chainlink BNB/USD rounds whose timestamps are after the seller observation start. The buyer/verifier additionally requires the first counted round to be strictly later than both the Promise freeze and the BSC-testnet funding timestamp. The buyer independently rereads every reported Chainlink round by exact round ID before the pair can validate.

No BNB mainnet trade is implemented. Mainnet is a read-only market-data source. Strategy accounting is paper accounting and must never be described as realized mainnet PnL.

## Protected runner

Runner:

`./scripts/g5-grid-forward-observed-pair.ps1`

Default invocation has no execution authority and runs only the read-only preflight.

Execution mode requires both:

- `-Execute`
- exact human-gate environment value `SPONDEE_G5_GRID_FORWARD_HUMAN_GATE=SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_EXECUTION_REQUIRED`

The live backend also independently requires `SPONDEE_G5_GRID_FORWARD_EXECUTION_ENABLED=true`, the existing BSC-testnet live gate, MegaFuel, the canonical seller, and a zero-balance ephemeral buyer.

## Authoritative CI

Workflow: `.github/workflows/g5-grid-forward-runner-preflight.yml`

Run `33845758154` completed with all three jobs PASS:

- `backend-forward-contract` — PASS
- `grid-forward-seller` — PASS
- `windows-runner-safety` — PASS

Backend regression: **50/50 tests PASS**.

The workflow proves that the protected live CLI fails before wallet/network writes when the execution gate is absent.

The seller workspace also passed:

- existing Grid category tests
- dedicated G5 forward seller tests
- strict TypeScript build
- forward-only/no-mainnet-write static invariants

The first failed seller attempt exposed an undeclared direct `viem` dependency. The final validated runtime removed that dependency and uses native JSON-RPC `fetch` for BSC-mainnet read-only Chainlink calls. No package/lockfile expansion was required.

## Read-only Chainlink preflight snapshot

The authoritative backend preflight read:

- network: BNB Chain mainnet
- chain ID: `56`
- feed: Chainlink BNB/USD
- feed address: `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE`
- source block: `119873132`
- freeze round: `55340232221132058636`
- freeze price: `721.15762341 USD`
- freeze round updated at: `2026-09-04T06:46:33.000Z`
- preflight frozen at: `2026-09-04T06:46:46.764Z`
- target future rounds: `8`
- maximum observation wait: `480s`
- encoded task bytes: `1216`
- sample Promise ID: `spg5_b1e2027530ec7ed48230bd60`
- sample Promise SHA-256: `bc9eda0feebd000402ef63fb871fbe3a3fe8c08ec4df1378ec7a23b6ff2870bf`
- service price: `0`

This snapshot is preflight evidence only. It is not the future execution freeze and contributes no observed pair.

## Truth boundary

At the end of this gate:

- wallet unlocked: **false**
- BSC-testnet chain write attempted: **false**
- BSC-mainnet chain write attempted: **false**
- user/mainnet capital moved: **false**
- new marketplace job created: **false**
- execution gate open: **false**
- countable Agent Advantage pairs: **0 / 3**
- Grid trading pair countable: **false**
- historical dry-run pair counted: **false**
- jobs 949 / 954 / 955 / 957 remain closed
- merge to main: not authorized
- final submission: not authorized

## Next protected gate

`SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_EXECUTION_REQUIRED`

This next gate is human-owned. If explicitly authorized, it permits one new **Grid G5** BSC-testnet zero-price marketplace job plus read-only BNB-mainnet Chainlink observation. It does not authorize meaningful mainnet value movement, user capital, paid spend, merge to main, or final submission.
