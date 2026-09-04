# Spondee G5 — Grid observed pair dry-run

Status: **PASS — STRUCTURALLY OBSERVED / NOT COUNTABLE FOR FINAL REPORT**  
Date: 2026-09-04 UTC

## Authority / safety

This gate used code, local paper execution and read-only public BNB Chain data only.

- wallet used: `false`
- chain write attempted: `false`
- user capital used: `false`
- mainnet value movement: `false`
- realized-mainnet-PnL claimed: `false`
- existing G4 jobs rerun: `false`

## Authoritative CI

- Grid dry-run run: `33843581388` — `PASS`
- hardened observed-evidence contract run: `33843642146` — `PASS`
- validated dry-run head: `b5bb3fa5302030268a42d8cbc22a88f06a8a9539`

Artifact:

- name: `spondee-g5-grid-observed-dry-run`
- artifact id: `9925716870`
- ZIP SHA-256: `69677a8cb7869bce2b9489b7f68f608f1913e1257ed926a645c60a1d1b0b7326`
- uploaded files: 8

## Frozen observed window

Pair: `g5-grid-dry-55340232221132058579`

Scenario: `g5-grid-dry-run-55340232221132058555-55340232221132058579`

Source:

- BNB Chain mainnet — **read only**
- Chainlink BNB/USD feed: `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE`
- source block: `119868943`
- observed rounds: `25`
- window start: `2026-09-04T06:01:57.000Z`
- window end: `2026-09-04T06:15:10.000Z`

Grid configuration was derived from the **first observed round only** (`no_lookahead_configuration=true`).

## Measured outputs

### Spondee Grid paper agent

- initial equity: `$10,000`
- terminal equity: `$9,993.479936`
- gross return: `-0.019367%`
- net return after declared friction: `-0.065201%`
- max drawdown: `0.074543%`
- estimated fee+slippage friction: `$4.583333`
- fills: `11`
- mark-to-market interval outcomes: `9 wins / 15 losses / 0 flat`

### Without-agent baseline

Static 50/50 USD/BNB on the exact same frozen path.

- initial equity: `$10,000`
- terminal equity: `$9,998.066520`
- gross/net return: `-0.019335%`
- max drawdown: `0.056784%`
- execution friction: `$0`
- mark-to-market interval outcomes: `11 wins / 13 losses / 0 flat`

### Observed delta

On this specific dry-run window, the Grid paper strategy **underperformed** the without-agent baseline after friction. That result is preserved as measured; it is not rewritten or hidden.

Approximate terminal-equity delta:

`$9,993.479936 - $9,998.066520 = -$4.586584`

Approximate net-return delta:

`-0.065201% - (-0.019335%) = -0.045866 percentage points`

## Raw artifacts

The CI artifact preserves:

- `input-snapshot.json`
- `market-data.json`
- `agent-output.json`
- `baseline-output.json`
- `timing-log.json`
- `cost-log.json`
- `pair-bundle.json`
- `dry-run-result.json`

Each pair artifact is bound by SHA-256 in `spondee.agent-advantage-pair.v1`.

## Countability boundary

The pair validated structurally as observed-data evidence, but:

- `marketplace_hire.mode = DRY_RUN_REFERENCE_AGENT`
- `agent_transport = LOCAL_REFERENCE_AGENT`
- `activation_reference = null`
- `countable_for_final_report = false`
- final `paired_run_count` remains `0`
- report remains `INSUFFICIENT_OBSERVED_EVIDENCE`

This is intentional. A historical replay cannot satisfy the final TermiX marketplace-hired pair requirement.

## Conclusion

`SPONDEE_G5_GRID_OBSERVED_PAIR_IMPLEMENTATION_AND_DRY_RUN_REQUIRED = PASS`

Next work must create a **forward-window** Grid pair whose Promise/marketplace activation occurs before observation begins, with an ERC-8183 BSC-testnet transaction tape, while still using read-only mainnet market data and no meaningful user/mainnet capital.
