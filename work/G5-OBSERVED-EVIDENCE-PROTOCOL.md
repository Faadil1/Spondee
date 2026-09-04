# Spondee G5 — Observed Agent Advantage Evidence Protocol

Date: 2026-09-04 UTC
Status: PREFLIGHT DESIGN
Scope: MUST-10, MUST-11, MUST-12, MUST-13

## Why this gate exists

The four-category G4 live-transport sequence is complete, but every current Outcome Receipt is explicitly `SIMULATION`. Those receipts prove Promise -> activation -> deliverable -> receipt plumbing. They do **not** satisfy the TermiX Agent Advantage requirement.

The official TermiX requirement is stricter: at least three real tasks must be run both ways (with an agent hired through the marketplace vs without), reporting time, cost and output quality with actual outputs attached; at least one task must be trading, stock or security. Trading evidence must include a real record with window and risk.

## Evidence class rule

`OBSERVED` is allowed only when the pair bundle contains:

1. one actual agent execution and one actual without-agent baseline execution;
2. the same frozen scenario ID;
3. the same observation window and initial/input state hashes;
4. external observed provenance from BSC testnet, public market data, or a public protocol API;
5. preserved raw input snapshot, agent output and baseline output;
6. measured time, cost and objective output-quality metrics;
7. explicit limitations;
8. for Grid Trading, a record containing window, wins/losses, drawdown, return and risk basis.

A declared simulation path, synthetic-only fixture, generated score, or existing G3/G4 SIMULATION receipt cannot be relabeled `OBSERVED`.

## Frozen pair schema

Implementation: `backend/src/observed-evidence.ts`

Canonical pair schema: `spondee.agent-advantage-pair.v1`

Each pair binds:

- `pair_id`
- category
- scenario ID
- observation mode
- observation window
- initial-state hash
- input-snapshot hash
- OBSERVED agent EvidenceRun
- OBSERVED baseline EvidenceRun
- measured time/cost/output-quality metrics
- raw artifact provenance + SHA-256
- optional/required trading record
- limitations and claim guardrail

The agent run must reference the exact baseline run by ID. The baseline cannot chain to another baseline. The final report remains `INSUFFICIENT_OBSERVED_EVIDENCE` below three validated pairs or when no Grid Trading pair is present.

## Proposed experiment order

### Pair 1 — Grid Trading — REQUIRED trading task

Target: an actual bounded task using a frozen live/testnet observation window, where the Spondee Grid agent is hired through the marketplace and compared with a no-agent baseline under the same inputs.

Preferred safe execution classes, in order:

1. BSC-testnet execution using test assets / bounded testnet notional;
2. if a live testnet execution surface is not viable, an observed-market-data replay with immutable raw market data and explicit `OBSERVED_MARKET_DATA_REPLAY` limitations.

Required record:

- observation window
- actual agent output
- actual baseline output
- completion time
- cost
- objective quality
- wins/losses/flat
- gross and net return for the declared window
- max drawdown
- risk basis
- execution environment

Do not describe a market-data replay as realized trading PnL.

### Pair 2 — Health Factor Monitoring — hero evidence

Target: actual warning/event/intervention timing evidence under the same frozen task for agent and without-agent baseline.

Required raw tape:

- promise timestamp
- warning timestamp
- action/intervention timestamp where applicable
- adverse-event timestamp
- useful warning lead time
- response latency
- actual cost
- actual output
- baseline detection/action timing

This pair is the preferred route for MUST-13.

### Pair 3 — Yield Optimisation — low-capital comparison

Target: agent vs direct/manual baseline for selecting the best eligible opportunity under the same live public protocol snapshot and risk cap.

Preferred first version is read-only/live-data task execution; capital movement is not required for the comparison itself.

Required raw evidence:

- protocol/API snapshot
- eligible opportunity set
- agent recommendation
- baseline/manual recommendation
- time
- cost
- objective quality metric such as correctness against frozen eligibility/risk constraints
- limitations

Rebalancing is the fallback third pair if Yield live-data provenance is weaker.

## Safety / authority

This protocol does not authorize meaningful mainnet or user capital.

Allowed at this preflight:

- code
- schemas/tests
- read-only public/onchain data discovery
- BSC testnet design/probes without new writes
- local benchmark harnesses

Not opened yet:

- new observed experiment chain writes
- mainnet value movement
- user capital
- material paid spend
- final public claims
- merge to main
- final submission

## Gate criteria

`SPONDEE_G5_OBSERVED_AGENT_ADVANTAGE_EVIDENCE_DESIGN_AND_PREFLIGHT_REQUIRED = PASS` when:

- strict pair schema/tests pass;
- SIMULATION->OBSERVED promotion fails closed;
- three-pair report requires a Grid pair;
- first Grid observed experiment path is qualified and bounded;
- no meaningful-capital authority is needed for the selected first experiment;
- execution runner can be prepared as a separate explicit gate.
