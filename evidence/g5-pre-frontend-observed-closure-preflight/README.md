# G5 Pre-Frontend Observed Closure — Preflight PASS

Date: 2026-09-04
Branch: `build/pre-frontend-closure`
Validated implementation head: `1ebecc1263c69464fc7b8b6b6f3fe5010dbe667e`
Authoritative workflow: GitHub Actions run `33868671297`

## Conclusion

`SPONDEE_G5_PRE_FRONTEND_OBSERVED_CLOSURE_PREFLIGHT_PASS`

The combined Health Factor + Rebalancing observed-evidence closure runner is ready for one human-local execution. No wallet was unlocked and no blockchain write was attempted by this preflight.

## Verified

- Windows PowerShell parse/safety: PASS.
- Full backend regression: PASS.
- Strict backend TypeScript: PASS.
- Health Agent Studio workspace install/build: PASS.
- Rebalancing Agent Studio workspace install/build: PASS.
- Read-only BSC mainnet BNB/USD Chainlink freeze + exact round reread: PASS.
- Static no-mainnet-write guards: PASS.
- Closed jobs `949`, `954`, `955`, `957`, `962` absent from new live runner/server write paths: PASS.
- Combined PowerShell no-write runner preflight: PASS.
- Artifact upload: PASS.

## Pair #2 — Health Factor

The frozen task uses a hypothetical collateral/debt position whose health factor is already inside a predeclared warning band. The marketplace-hired agent continuously monitors future BNB/USD Chainlink rounds; the without-agent baseline checks only at a precommitted periodic cadence (four future rounds).

Countable output requires:

- live BSC-testnet ERC-8183 marketplace hire;
- Promise before the future observation window;
- future observed Chainlink rounds only;
- exact independent round reread;
- warning event tape;
- positive warning lead time against the frozen baseline cadence;
- response-latency measurement;
- zero service price / MegaFuel;
- no mainnet value movement;
- no liquidation-prevention or safety claim.

## Pair #3 — Rebalancing

The frozen task uses a hypothetical paper 50/50 BNB/USD portfolio. The agent performs bounded paper rebalances when target deviation exceeds a precommitted tolerance. The without-agent baseline holds the exact same frozen allocation through the exact same future observed rounds.

Countable output requires:

- live BSC-testnet ERC-8183 marketplace hire;
- same-window future observed Chainlink rounds;
- exact independent round reread;
- terminal allocation-deviation comparison;
- paper execution-friction model disclosed;
- zero service price / MegaFuel;
- no mainnet trade;
- no realized-PnL claim;
- negative or neutral outcome preserved if observed.

## Combined runner

`scripts/g5-pre-frontend-observed-closure.ps1`

Execution gate:

`SPONDEE_PRE_FRONTEND_OBSERVED_CLOSURE_EXECUTION_REQUIRED`

The runner asks for the canonical seller wallet password once through a masked local prompt, runs Health first, stops on first failure, and runs Rebalancing only if Health closes PASS. It never prints or persists the seller password.

## Public deployment

Deployment adapter/configuration is prepared separately on the same branch (`api/index.mjs`, `vercel.json`). An attempted connected Vercel API deployment on 2026-09-04 was rejected before deployment because the account had exhausted its daily API deployment quota (100/100). No Spondee deployment was created by that attempt. This is an external quota blocker, not an application build failure.
