# G5 Health Factor Forward Observed Pair — Job 971 — PASS / COUNTABLE

Date: 2026-09-04  
Category: Health Factor Monitoring  
Pair ID: `g5-health-forward-job-971`  
Job ID: `971`  
Evidence class: `OBSERVED`  
Countable for final report: `true`

## Conclusion

`SPONDEE_G5_HEALTH_FORWARD_OBSERVED_PAIR_PASS`

This pair closes the Health Factor observed warning/intervention event-tape requirement using a frozen hypothetical position and future BNB/USD Chainlink observations. It does **not** claim that Spondee prevented liquidation or guaranteed safety.

## Marketplace activation

- Network: BSC testnet
- Provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- Buyer: `0xCF71595866a9E5f6Aa573fA5680c87813B755979`
- Promise ID: `sph5_7641f3d8563fa606519b9785`
- Scenario ID: `g5-health-forward-55340232221132059396-1788528926017`
- Service price: `0`
- Buyer balance before: `0 wei`
- Buyer balance after: `0 wei`
- Mainnet value moved: `false`

Transactions:

- CREATE_JOB: `0x76b5a6843205f31d3d64ebf2f0e73cd1a4ec741b486003c99113e63b43d92fde`
- REGISTER_JOB: `0xdd1efd6aaa24c9948f83cd3dc3fb45a7f2038a26a797bd9004b8942cacb4927d`
- SET_BUDGET: `0x4be68a38d896f02150c15e67e85c367ea96de1656693f4751d4a0ecb53ff19c6`
- FUND: `0xdcdba09a50af5c543daa9f2f5a88c8937d18d151adf1c687e4dfd806fea41425`
- SUBMIT_OBSERVED: `0xd8f9d4ccbde991da9d8db0e8659c8a15fcdfb524f490fac5d8c27124a65743e3`

## Observed event tape

Observation window:

- start: `2026-09-04T13:35:43.000Z`
- end: `2026-09-04T13:38:11.000Z`
- future observed Chainlink rounds: `6`
- external round verification: `PASS`
- manifest hash verified: `true`

Measured hero evidence:

- warning lead time: `95.829 s`
- response latency: `0 ms`
- adverse event observed during bounded window: `false`
- liquidation prevention claimed: `false`

The pair used the predeclared without-agent periodic-check baseline and preserves the result even though no adverse event occurred during the bounded window.

## Truth boundary

- The position is hypothetical/paper evidence; no user capital was placed at risk.
- BNB Chain mainnet was used only for read-only Chainlink market observations.
- No mainnet transaction or value movement occurred.
- Warning lead time is a measured timing difference under the frozen protocol, not a guarantee of liquidation prevention.

## Raw local bundle

The original runner preserved the raw bundle at:

`C:\Users\fboussari\AppData\Local\Temp\spondee-g5-health-forward-20260904-093446`

Use `scripts/archive-g5-pre-frontend-evidence.ps1` before temporary-file cleanup to copy the raw bundle into the repository evidence tree.
