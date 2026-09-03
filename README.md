# Spondee

**Agents, measured by what they deliver.**

Spondee is the BNB Agent Studio / Build the Era project for a calibrated outcome marketplace: users compare live BSC agents by task-specific measurable promises — expected outcome, confidence, downside, cost and timing — then receive an Outcome Receipt comparing promise to actual result and, where measured, agent performance to an observed no-agent/manual baseline.

## Current state

`PROJECT_AUTHORIZED -> CONTEXT_RECOVERED -> PRD_DRAFTED -> PRD_VALIDATED -> PRD_READY -> SPEC_KIT_G3_READY_FOR_PBPD_IMPLEMENTATION`

The pre-build gate is complete. A reproducible GitHub Actions preflight verified Node 22, pnpm 10, `@bnbagent/studio-cli`, BSC testnet connectivity, credential-free reference-agent scaffolding, `bag scan` and `bag doctor`.

The first bounded Spec Kit pilot is now active for Spondee G3. Derived constitution/spec/plan/tasks live in `Faadil1/spec-kit-orchestration/projects/bnb_agent_studio_build_the_era_2026/`; they do not replace this repository's living PRD or PBPD canonical state. PBPD remains the implementation owner.

## Locked product direction

**Calibrated Outcome Marketplace + Intervention Advantage**

Required BNB categories:

1. Rebalancing — LP range management / reset
2. Grid Trading
3. Yield Optimisation
4. Health Factor Monitoring

Hero vertical: **Health Factor Monitoring**.

## Canonical product/build sources

Read in this order for Spondee product/build continuation:

1. `.pbpd/state/PROJECT-STATE.yaml`
2. `.pbpd/state/AUTHORITY-STATE.yaml`
3. `incoming/PRODUCT-REQUIREMENTS-DOCUMENT.md`
4. `.pbpd/state/DECISION-LOG.yaml`
5. `.pbpd/state/REQUIREMENTS-LEDGER.yaml`
6. `.pbpd/state/EVIDENCE-LEDGER.yaml`
7. `.pbpd/state/RISK-REGISTER.yaml`
8. `.pbpd/state/ACTIVITY-TRACE.yaml`
9. `Faadil1/spec-kit-orchestration/state/CURRENT.yaml` and the Spondee project-local Spec Kit execution bundle when specification/planning/convergence context is needed.

Canonical product intent stays in the living PRD. Build discoveries must be captured and classified; any approved product clarification or material product change updates the PRD first, then derived Spec Kit artifacts are reconciled.

## Governance

Canonical inputs live under `incoming/`.
Canonical PBPD state lives under `.pbpd/state/`.
Runtime preflight evidence lives under `evidence/runtime-preflight-001/`.

Protected final submission remains human-owned. Meaningful mainnet/user capital and material paid spend remain human-gated.

## Next gate

`SPONDEE_G3_VERTICAL_SLICE_PROMISE_ACTIVATE_RECEIPT`

First build objective: reproduce/configure one Spondee Health Factor reference agent in the authorized workspace, complete secure BSC-testnet onboarding and a local `bag dev` smoke, generate and persist a task-specific Promise Card before bounded activation, exercise the activation path, produce the first Outcome Receipt with preserved evidence, run a negative-path test, and reconcile any discoveries through the living-PRD/Spec Kit loop.
