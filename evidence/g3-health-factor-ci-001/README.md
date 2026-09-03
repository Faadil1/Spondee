# Spondee G3 Health Factor — Credential-Free Evidence 001

Date: 2026-09-03
Branch: `build/g3-health-factor`
Evidence class: `SIMULATION / CI / NO_WALLET`

## Verified build

GitHub Actions run: `33753788773`
Verified product head: `010d5ef9d349b0e253565a8e653f3d9f580f1f91`
Conclusion: `SUCCESS`

PASS stages:
- workspace dependency install;
- deterministic Spondee tests;
- TypeScript compilation;
- reproducible Promise/Receipt evidence export;
- artifact upload;
- `bag scan`;
- `bag doctor`.

A previous run (`33753280627`) also passed the same code/config family before the demo-evidence export was added.

## Demo evidence artifact

Artifact ID: `9892600637`
Name: `spondee-g3-health-factor-demo-evidence`
Digest: `sha256:8ca6c0f5ab50e5673ca9f515c1b4bd0b9fce957c1adf7f67beff24017d292b41`

Files:
- `Scenario.json`
- `PromiseCard.json`
- `OutcomeReceipt.json`

Observed deterministic values for scenario `spondee-hf-demo-001`:

```text
promise_id = sp_87c1d19f5bc0cda01d586131
service price = 0
confidence = null
confidence_status = UNSCORED_UNTIL_OBSERVED_CALIBRATION
HF floor = 1.20
minimum declared-stress HF = 1.12
projected floor crossing = 525s
warning issue = 405s
useful lead = 120s
receipt evidence_class = SIMULATION
observed-agent-advantage eligibility = false
```

The Promise Card and Outcome Receipt carry the same `promise_id` and scenario ID.

## Agent Studio integration properties

Verified in tests and source:

1. `preview_health_factor` is a free/read-only Agent Studio skill.
2. Preview uses deterministic Health Factor math and does not sign, pay or call an LLM.
3. `negotiate` recomputes the same Promise Card and injects it into `terms.spondee_promise` before fixed-code ERC-8183 quote signing.
4. Structured Spondee Health Factor fulfillment returns a deterministic Outcome Receipt and bypasses the generic LLM path.
5. Generic non-Spondee work is not intercepted.
6. G3 ERC-8183 price/min/max are all `0`.
7. x402/B402 is disabled for G3.
8. LLM auto-renew is disabled for G3.

## Current claim boundary

This evidence proves the software plumbing and deterministic simulation behavior only.

It does **not** prove:
- a live wallet-backed signature;
- a funded ERC-8183 job;
- an on-chain delivery transaction;
- liquidation prevention;
- observed prediction calibration;
- observed Agent Advantage.

Those claims remain blocked until the live BSC-testnet activation gate.

## Wallet / gas reconciliation

Current official BNB documentation is not uniform in wording: the Agent Studio v2 launch blog says Paymaster covers testnet gas broadly, while the current Studio demo/SDK network docs explicitly instruct operators to fund a throwaway wallet with tBNB for general testnet operations and state that ERC-8004 registration is gas-sponsored via MegaFuel.

For Spondee, use the conservative operational interpretation:
- ERC-8004 registration may be sponsored;
- assume ERC-8183/general BSC-testnet operations require a small tBNB balance until the installed CLI proves otherwise;
- never reuse the throwaway wallet on mainnet.

Official references:
- https://docs.bnbchain.org/developer-kit/bnbchain-studio/quickstart/
- https://docs.bnbchain.org/developer-kit/bnbchain-studio/demo/
- https://docs.bnbchain.org/developer-kit/bnbagent-sdk/
- https://docs.bnbchain.org/developer-kit/bnbagent-sdk/networks/

## Next gate

`SPONDEE_G3_LIVE_TESTNET_ACTIVATION_REQUIRED`

Requires explicit human participation/approval for secure throwaway wallet creation and, if needed, acquisition of a minimal tBNB testnet balance. Wallet passwords/private keys must remain outside chat and repository history.
