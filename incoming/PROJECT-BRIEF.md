# Spondee — Project Brief

Project ID: `bnb_agent_studio_build_the_era_2026`

## Opportunity

BNB Chain's Build the Era challenge asks for a marketplace/front end that lets users find, understand and activate live BSC agents across four first-class categories:

1. Rebalancing — LP range management / automatic position reset
2. Grid Trading
3. Yield Optimisation
4. Health Factor Monitoring

The product must remain useful as a marketplace rather than becoming only infrastructure or analytics.

## Product thesis

Spondee is a **Calibrated Outcome Marketplace**.

Users do not compare agents primarily through stars or generic reputation. For a specific task, each agent is represented through a measurable **Promise Card** containing:

- expected outcome;
- confidence / probability of meeting the objective;
- expected downside / risk bound;
- price / fee;
- expected execution or intervention timing where relevant;
- observed advantage and calibration history when evidence exists.

After execution or observation, Spondee creates an **Outcome Receipt** binding the original promise to actual evidence.

For time-critical jobs, the hero mechanism is **Intervention Advantage**: signed warnings are evaluated by useful lead time, precision, calibration and actionability.

## Hero demo

Health Factor Monitoring.

Preferred sequence:

`marketplace -> agent -> Promise Card -> bounded activation -> deterministic stress scenario -> signed warning -> intervention -> Outcome Receipt`

The receipt must contain real timestamps and real evidence artifacts. No invented human timings or performance claims.

## Agent Advantage evidence

Minimum target experiments:

1. Health Factor Protection
2. Grid Trading — explicit trading task
3. LP Range Rebalancing
4. Yield Optimisation only if the first three are complete and reproducible

Each paired experiment preserves initial state/scenario, agent/version, promise, timestamps, transaction hashes/output artifacts, actual cost/outcome, observed baseline and advantage delta.

## Reuse

- 8004scan: identity, capability, ownership, reputation, feedback and network/discovery substrate
- BNB Agent Studio: agent/execution surface
- Altana: bounded sessions, allowlists, spend caps, expiry/revoke and ERC-8183/x402 where practical
- BSC testnet first
- PancakeSwap/Venus only where they naturally serve a category

## Do not build as the core product

- custom agent identity or reputation registry
- generic directory/search engine
- generic RFQ / reverse Dutch auction
- performance bonds / underwriting
- tournament / league
- generic coalition or agent-to-agent orchestration
- generic red-team/testing layer
- bounty/verifier clearing
- general backtesting platform

## Capacity constraint

Known collision window includes JigJoy Sep 4–6 and Syndicate / Maximor Sep 5–6. Keep Spondee evidence-first and narrow until the primary vertical is real.

## Current gate

`SPONDEE_PRD_VALIDATION_AND_RECONCILIATION`

No consequential product implementation before `PRD_READY`.
