# Spondee — PRD READY Declaration

Date: 2026-09-03
Project: `bnb_agent_studio_build_the_era_2026`
PRD: `incoming/PRODUCT-REQUIREMENTS-DOCUMENT.md` v0.1

## Decision

`PRD_READY`

The PBPD pre-build gate is satisfied.

## Basis

1. Human project authorization is present and bounds the objective.
2. Product name, thesis, Primary Path and Hero Demo are locked.
3. PRD v0.1 passed the PBPD checklist in `work/PRD-VALIDATION-001.md`.
4. Requirements, evidence, risk, decision, authority and artifact ledgers are reconciled.
5. Bounded external reconnaissance confirmed that BNB Agent Studio can create Spondee-owned reference agents on BSC instead of depending on perfect pre-existing marketplace agents.
6. Runtime preflight GitHub Actions run `33752070626` passed.
7. The current CLI `@bnbagent/studio-cli 0.0.13` installed successfully on Node 22.
8. BSC testnet RPC returned chain ID `0x61`.
9. `bag init` successfully scaffolded the credential-free `spondeehealth` reference-agent probe.
10. `bag scan` exited 0 and classified the generated workspace as deploy-ready.
11. `bag doctor` exited 0 and confirmed network, agent entrypoint, ERC-8183/x402 configuration, bundle dry-run and Studio skill surface.

Raw durable summary: `evidence/runtime-preflight-001/README.md`.

## Expected onboarding gaps — not PRD blockers

The credential-free preflight intentionally did not create or expose secrets. Before real local execution/deployment, G3 must still:

- create a throwaway/testnet agent wallet using hidden `WALLET_PASSWORD` handling;
- activate/configure the chosen LLM provider;
- set the ERC-8183 price ceiling;
- install Bun 1.3+ before deployment;
- configure B402 credentials only if the paid x402 rail is actually used;
- run a live local `bag dev` smoke and capture the first real Promise -> Activate -> Outcome Receipt evidence.

These are implementation/onboarding tasks inside the already authorized G3 vertical, not unresolved product-definition questions.

## Build authority

Consequential implementation may now begin **only within the existing authorization ceiling and PRD scope**.

Protected actions remain protected:
- no meaningful mainnet/user capital;
- no material paid spend without new human approval;
- no unsupported financial/safety claims;
- final hackathon submission remains human-owned.

## Next exact gate

`SPONDEE_G3_VERTICAL_SLICE_PROMISE_ACTIVATE_RECEIPT`

PASS definition:

One Spondee reference agent can be configured for the preferred Health Factor vertical, started through a real local/BSC-testnet-compatible path, exposed with a task-specific Promise Card, activated through bounded authority, and produce an Outcome Receipt with preserved evidence. If Health Factor integration is materially slower than another official category, PBPD may use a faster category only as a bounded implementation pivot while keeping Health Factor as the intended hero unless evidence forces a product-level change.
