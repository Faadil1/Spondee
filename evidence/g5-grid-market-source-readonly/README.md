# Spondee G5 — Grid observed market source read-only qualification PASS

Date: 2026-09-04 UTC
Authoritative CI run: `33842784851`
Validated head: `ac812dda401827610ac1dc2725e9f1508df111cc`

## Result

`SPONDEE_G5_GRID_MARKET_SOURCE_READ_ONLY_PASS`

## Source

- network: BNB Chain mainnet
- chain ID: `56`
- RPC: `https://bsc-dataseed.bnbchain.org`
- Chainlink feed: BNB / USD
- feed address: `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE`
- decimals: `8`
- probe block: `119867346`

The probe used only `eth_call`/read methods through viem. No wallet, private key, transaction, write contract, or user capital was used.

## Observed rounds captured by CI

| Round | BNB/USD | Updated at (UTC) |
|---|---:|---|
| `55340232221132058553` | `724.4698004` | `2026-09-04T06:00:51Z` |
| `55340232221132058554` | `724.45660449` | `2026-09-04T06:01:24Z` |
| `55340232221132058555` | `724.43926779` | `2026-09-04T06:01:57Z` |
| `55340232221132058556` | `724.17522773` | `2026-09-04T06:02:30Z` |
| `55340232221132058557` | `724.12684` | `2026-09-04T06:03:03Z` |

## Qualification

This source qualifies as external observed provenance for a future Grid Agent Advantage pair.

It does **not** by itself prove trading performance. A valid pair still requires an actual with-agent execution, an actual without-agent baseline execution, the same frozen observation window/state, actual outputs, measured time/cost/quality, and a Grid record containing window, outcomes and risk.

## Safety

- wallet used: false
- chain write attempted: false
- user capital used: false
- mainnet access class: read-only data only
