# Spondee Backend CI Evidence 001

Date: 2026-09-03
Branch: `build/backend-complete`
Evidence class: `SIMULATION / CI / READ-ONLY-CHAIN`

## Result

GitHub Actions run: `33801590780`
Verified backend-code head: `b415fbab33416b32fd75dac12515a502c29be14c`
Conclusion: **SUCCESS**

Artifact:
- ID: `9911265991`
- name: `spondee-backend-ci-evidence`
- digest: `sha256:9b7fd3ca1a4f6ba24b409d096df96842696e1a307d6fb3327d3b280db5534a56`

## Passed gates

- 18/18 unit + API integration tests;
- strict TypeScript compilation;
- four-category Promise/Receipt smoke;
- claim-boundary assertions;
- live-deliverable Promise/scenario/evidence-class guardrails;
- read-only BSC Testnet chain probe;
- pinned SDK reports ERC-8183 paymaster support for chain 97;
- AgenticCommerce contract code present;
- EvaluatorRouter contract code present;
- OptimisticPolicy contract code present;
- evidence artifact uploaded.

No live chain write was attempted.

## Four-category backend smoke

All four required BNB categories completed the same backend path:

`Task -> Promise Card -> Simulation Activation -> Outcome Receipt`

| Category | Reference agent | Promise | Receipt | Confidence | Price | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Health Factor Monitoring | `spondee-health-factor` | `sp_cd02d93660a08179706a28b2` | `sr_0707d6a914002788217bdb40` | null | 0 | SIMULATION |
| Grid Trading | `spondee-grid` | `sp_6db7cf635dc171dc1af1410c` | `sr_80ab3b234def62e4c7451a62` | null | 0 | SIMULATION |
| Rebalancing | `spondee-rebalancing` | `sp_2828ef595bb91a8921d6450a` | `sr_71a9c26307dae6945be39f47` | null | 0 | SIMULATION |
| Yield Optimisation | `spondee-yield` | `sp_da8f53d17a8f04f81aad75c0` | `sr_00a7663f58dbe46e25fbcff2` | null | 0 | SIMULATION |

For every row:
- `confidence = null`;
- service price = `0`;
- simulation evidence is **not eligible** for observed Agent Advantage.

## Public BSC Testnet probe

Observed read-only values:

```text
network = bsc-testnet
chain_id = 97
provider = 0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8
provider_balance_wei = 0
funded_for_gas = false
sdk_erc8183_paymaster_supported = true
AgenticCommerce code = present
EvaluatorRouter code = present
OptimisticPolicy code = present
live_write_attempted = false
```

The pinned `@bnbagent/sdk` marks BSC Testnet chain 97 as ERC-8183 paymaster-supported. This means MegaFuel sponsorship is an available runtime path; it is **not** treated as a guarantee that the relay will be available for a particular write. A small tBNB balance remains a useful fallback.

## Backend surfaces verified

- marketplace category/agent catalog;
- 8004scan/ERC-8004 identity substrate boundary;
- deterministic Promise Card creation;
- activation orchestration;
- deterministic simulation Outcome Receipts;
- memory persistence for CI/demo;
- PostgreSQL persistence implementation + migration;
- observed evidence ingestion;
- Agent Advantage pairing/report logic;
- observed-only calibration summary;
- fail-closed signed zero-price ERC-8183 live driver;
- runtime readiness endpoint.

## Live ERC-8183 path prepared but NOT claimed

The prepared driver now preserves the complete evidence path:

`signed A2A quote`
`-> verify provider/currency/signature`
`-> buildJobDescription(same signed terms)`
`-> createJob`
`-> registerJob`
`-> setBudget(0)`
`-> fund(0)`
`-> notify_funded`
`-> poll SUBMITTED/COMPLETED`
`-> locate JobSubmitted event`
`-> capture create/register/budget/fund/submit tx hashes`
`-> get on-chain deliverable_url`
`-> fetch DeliverableManifest`
`-> verify manifest hash against job.deliverable`
`-> verify Spondee receipt promise_id + scenario_id + SIMULATION truth class`
`-> persist normalized Outcome Receipt in the backend`

Progress is persisted after each live stage, so a later manifest or transport failure does not erase already-landed transaction evidence.

It cannot execute unless the explicit live environment gate and a separate local buyer keystore are present.

The following remain **unverified**:
- live buyer wallet-backed signing;
- actual `createJob/registerJob/setBudget(0)/fund(0)` transactions;
- provider `submit` transaction;
- on-chain Outcome Receipt/deliverable evidence;
- observed Agent Advantage;
- three non-Health-Factor reference agents deployed live.

## Next exact gate

`SPONDEE_BACKEND_COMPLETE_LIVE_TESTNET_E2E_PENDING_TBNB`

The human has chosen to defer the first live write until the next tBNB attempt. Technically, the pinned SDK also supports the ERC-8183 paymaster on chain 97, so tBNB is a fallback rather than a claim that sponsorship is impossible.

At the live gate: create/verify a separate throwaway buyer testnet wallet locally, start the Health Factor seller endpoint, run the signed zero-price ERC-8183 path, preserve job/tx/deliverable evidence, and only then promote the live G3 requirement.
