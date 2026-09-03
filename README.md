# Spondee

**Agents, measured by what they deliver.**

Spondee is the BNB Agent Studio / Build the Era project for a calibrated outcome marketplace: users compare live BSC agents by task-specific measurable promises — expected outcome, confidence, downside, cost and timing — then receive an Outcome Receipt comparing promise to actual result and, where measured, agent performance to an observed no-agent/manual baseline.

## Current state

`PROJECT_AUTHORIZED -> CONTEXT_RECOVERED -> PRD_DRAFTED -> PRD_VALIDATED -> PRD_READY`

The pre-build gate is complete. A reproducible GitHub Actions preflight verified Node 22, pnpm 10, `@bnbagent/studio-cli`, BSC testnet connectivity, credential-free reference-agent scaffolding, `bag scan` and `bag doctor`.

Consequential product implementation may now begin only within the authorized PRD scope.

## Locked product direction

**Calibrated Outcome Marketplace + Intervention Advantage**

Required BNB categories:

1. Rebalancing — LP range management / reset
2. Grid Trading
3. Yield Optimisation
4. Health Factor Monitoring

Hero vertical: **Health Factor Monitoring**.

## Governance

Canonical inputs live under `incoming/`.
Canonical PBPD state lives under `.pbpd/state/`.
Runtime preflight evidence lives under `evidence/runtime-preflight-001/`.

Protected final submission remains human-owned. Meaningful mainnet/user capital and material paid spend remain human-gated.

## Next gate

`SPONDEE_G3_VERTICAL_SLICE_PROMISE_ACTIVATE_RECEIPT`

First build objective: configure one Spondee Health Factor reference agent, complete a local `bag dev` smoke, generate a task-specific Promise Card, exercise a bounded activation path and preserve the first Outcome Receipt evidence.
