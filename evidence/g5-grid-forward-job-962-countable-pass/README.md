# G5 Grid Forward Observed Pair — Job 962 — COUNTABLE PASS

Date: 2026-09-04
Source: human-local canonical runtime on `build/g5-grid-forward-observed`
Runner: `scripts/g5-grid-forward-observed-pair.ps1 -Execute`
Truth class: OBSERVED / COUNTABLE FOR FINAL REPORT

## Result

`SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_PASS`

This is the first Spondee Agent Advantage pair that satisfies the hardened countability contract. It is a marketplace-hired BSC-testnet Grid task whose Promise/config was frozen before a future observed BNB/USD window. The market-data window was read from Chainlink on BSC mainnet in read-only mode and every counted round was independently re-read by exact round ID. No mainnet value moved and paper accounting is not realized PnL.

## Marketplace activation

- Network: BSC Testnet / chain 97
- Provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- Ephemeral buyer: `0x9423f5B1Ae49A93Ee8757D5793b3019d17a12023`
- Buyer balance before: `0 wei`
- Buyer balance after: `0 wei`
- Service price: `0`
- Gas path: MegaFuel
- Job ID: `962`
- Pair ID: `g5-grid-forward-job-962`
- Promise ID: `spg5_6be8ca0d0f37354475b0f656`
- Scenario ID: `g5-grid-forward-55340232221132059004-1788516525376`

Transactions:

- createJob: `0x8d502976faa5c47bd2d73e842a7ed083576ad07a301c4232fa4b6d9e940a81f1`
- registerJob: `0x8e1f998d56e8c7cafc25b5c5e7b72b6129b98f0247288dfdd0295478a6415c2e`
- setBudget(0): `0xc0582528b34183387e9183d0a3bfee50fe925849fd8b7387ab0076346f11aea2`
- fund(0): `0x434223db54f30510616e74ae6e2c554ecc9a26a6017ea172df4eff29a4e8b266`
- provider submit: `0xd1273c9d11c88fbd92d73ff595ac507db718c88ac0c3896a8105854550d488d5`

## Forward observed window

- Freeze round: `55340232221132059004`
- Observed round count: `8`
- Window start: `2026-09-04T10:09:09.000Z`
- Window end: `2026-09-04T10:13:00.000Z`
- External round verification: `PASS`
- Manifest hash verified: `true`

## Measured pair result

Agent Grid terminal equity: `$9,996.660009`

Without-agent static 50/50 baseline terminal equity: `$9,999.160009`

Terminal-equity delta (agent - baseline): `-$2.500000`

The agent **underperformed** the baseline on this observed window. Spondee preserves this result as measured evidence; it must not be reframed as the agent beating the baseline.

## Countability / claim boundary

- `countable_for_final_report = true`
- `paired_run_count_after_pair = 1`
- `final_report_status_after_pair = INSUFFICIENT_OBSERVED_EVIDENCE`
- Trading-related pair requirement: satisfied by this pair
- Remaining required countable pairs: `2`
- Mainnet value moved: `false`
- Realized mainnet PnL claimed: `false`
- Secrets printed: `false`

The pair proves reproducible marketplace-hired forward observation and comparison. It does **not** prove guaranteed profit, superior performance in general, or realized trading returns.

## Prior pre-write failure

The immediately preceding authorized attempt failed before any BSC-testnet write because its signed on-chain description exceeded the 1600-byte MegaFuel budget. Compact wire remediation passed CI in run `33859221865`; that zero-write failure consumed no job authority. Job 962 is the single job created under the subsequently remediated execution.

## Closed runtime rule

Job `962` is now CLOSED. Do not rerun, recreate, resubmit or mutate it. Any future observed pair must use a new dedicated gate and task scope.
