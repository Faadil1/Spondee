# G5 Rebalancing Forward Observed Pair — Job 973 — PASS / COUNTABLE

Date: 2026-09-04  
Category: Rebalancing  
Pair ID: `g5-rebalancing-forward-job-973`  
Job ID: `973`  
Evidence class: `OBSERVED`  
Countable for final report: `true`

## Conclusion

`SPONDEE_G5_REBALANCING_FORWARD_OBSERVED_PAIR_PASS`

This pair is the third countable observed Agent Advantage pair. The measured result is deliberately preserved as **neutral**: agent and without-agent baseline finished with the same terminal equity and terminal deviation on this bounded observed window.

## Marketplace activation

- Network: BSC testnet
- Provider: `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`
- Buyer: `0x935f5F36Dd79b483f49cCcC10c9681628EAC663C`
- Promise ID: `spr5_051cd6d268014897e226c4a6`
- Scenario ID: `g5-rebalancing-forward-55340232221132059403-1788529120382`
- Service price: `0`
- Buyer balance before: `0 wei`
- Buyer balance after: `0 wei`
- Mainnet value moved: `false`

Transactions:

- CREATE_JOB: `0xce0dc37bcd03769427cc55c2ca1aeee2a77ddb0cf859364e7777305035c51b06`
- REGISTER_JOB: `0x38ece5e3fe4afe73890618901442cd823d1ad5ab0baec1b52377bb59e9c3a5a8`
- SET_BUDGET: `0x64d3b64d92361a99ef32516645a69af3f1145ac4b1b60af45fb1c1d2b65e4ce6`
- FUND: `0x0bc3929f80def150fd7c906c5e7f91fa9eca14883939695eaed7223d13c95d34`
- SUBMIT_OBSERVED: `0xc87315f8ab5199b74a5828eb71c7c6bacd61568f4a6075cae48ec6cf9f6d1dea`

## Observed comparison

Observation window:

- start: `2026-09-04T13:38:55.000Z`
- end: `2026-09-04T13:41:40.000Z`
- future observed Chainlink rounds: `6`
- external round verification: `PASS`
- manifest hash verified: `true`

Measured result:

- agent terminal deviation: `1.363132 bps`
- baseline terminal deviation: `1.363132 bps`
- agent terminal equity: `$10,002.727008`
- baseline terminal equity: `$10,002.727008`
- terminal equity delta: `$0.00`
- interpretation: `NEUTRAL_AGENT_EQUALS_BASELINE_ON_THIS_WINDOW`
- realized mainnet PnL claimed: `false`

## Truth boundary

- This is paper/hypothetical portfolio evidence, not realized PnL.
- BNB Chain mainnet was used only for read-only Chainlink market observations.
- No mainnet transaction or value movement occurred.
- The neutral result is preserved exactly; it is not reframed as a performance win.

## Raw local bundle

The original runner preserved the raw bundle at:

`C:\Users\fboussari\AppData\Local\Temp\spondee-g5-rebalancing-forward-20260904-093446`

Use `scripts/archive-g5-pre-frontend-evidence.ps1` before temporary-file cleanup to copy the raw bundle into the repository evidence tree.
