# Spondee G5 — Observed Agent Advantage Evidence Protocol

Date: 2026-09-04 UTC
Status: IMPLEMENTATION PREFLIGHT
Scope: MUST-10, MUST-11, MUST-12, MUST-13

## Why this gate exists

The four-category G4 live-transport sequence is complete, but every current Outcome Receipt is explicitly `SIMULATION`. Those receipts prove Promise -> activation -> deliverable -> receipt plumbing. They do **not** satisfy the TermiX Agent Advantage requirement.

The TermiX requirement is stricter: at least three real tasks must be run both ways (with an agent hired through the marketplace vs without), reporting time, cost and output quality with actual outputs attached; at least one task must be trading, stock or security. Trading evidence must include a record with window and risk.

## Two separate thresholds

A bundle can be structurally valid `OBSERVED` evidence without being countable for the final report.

### Structural OBSERVED

Allowed only when the bundle contains preserved measurements from an actual live task or immutable observed-data replay, including:

1. identical frozen scenario/input state for agent and baseline;
2. external provenance from BSC/public market/protocol data;
3. raw input, agent output, baseline output, timing and cost artifacts with SHA-256;
4. objective time/cost/output-quality metrics;
5. explicit limitations;
6. for Grid, MARKET_DATA plus a trading record containing window, outcomes, drawdown, gross/net return and risk basis.

A simulation fixture or G3/G4 `SIMULATION` receipt cannot be relabeled `OBSERVED`.

### Countable Agent Advantage pair

To count toward the required `3/3`, structural validity is not enough. The bundle must additionally prove:

- `marketplace_hire.mode = LIVE_BSC_TESTNET_MARKETPLACE`;
- `agent_transport = ERC8183_BSC_TESTNET`;
- a concrete activation reference;
- Promise/freeze before the forward observation window;
- a preserved `TRANSACTION_TAPE`;
- non-historical observation mode.

Historical observed-data replays and local reference-agent dry runs are always `countable_for_final_report=false`.

## Frozen pair schema

Implementation: `backend/src/observed-evidence.ts`

Canonical pair schema: `spondee.agent-advantage-pair.v1`

Each pair binds pair ID, category, scenario, window, state hashes, marketplace-hire evidence, OBSERVED agent/baseline runs, measured metrics, raw artifact provenance, trading/event evidence, limitations and claim guardrail.

The final report uses **only countable pairs** and remains `INSUFFICIENT_OBSERVED_EVIDENCE` below three countable pairs or when no countable Grid Trading pair is present.

## Pair 1 — Grid Trading

### Dry-run gate

`backend/src/g5-grid-observed-dry-run.ts` uses immutable read-only Chainlink BNB/USD rounds from BNB Chain mainnet. It:

- reads no wallet and sends no transaction;
- freezes a historical observed window;
- configures the paper-grid from the first observed round only, preventing look-ahead configuration;
- executes a bounded paper-grid and a without-agent static 50/50 baseline on the exact same rounds;
- records local computation time, paper execution friction, terminal equity, drawdown, interval outcomes and raw outputs;
- validates the pair schema;
- MUST remain `countable_for_final_report=false` because no marketplace hire occurred before that historical window.

This proves harness integrity only. It is not the final trading pair and must not be described as realized PnL.

### Later countable Grid execution

After dry-run PASS, a separate explicit gate may freeze a **forward** live-public-data window, create a new bounded zero-price BSC-testnet marketplace activation for the Grid agent before the window starts, preserve the exact activation transaction/job tape, and evaluate agent vs baseline over the same future Chainlink rounds. No meaningful mainnet/user capital is required.

## Pair 2 — Health Factor Monitoring

Target: actual warning/event/intervention timing evidence under the same frozen task for agent and without-agent baseline. Required raw tape includes promise, warning, action/intervention, adverse event, useful lead time, response latency, cost and baseline timing.

## Pair 3 — Yield Optimisation

Target: agent vs direct/manual baseline on the same live public protocol snapshot and risk cap. Capital movement is not required for the comparison itself. Rebalancing remains fallback.

## Safety / authority

Allowed in the current Grid dry-run gate:

- code and tests;
- read-only BSC mainnet Chainlink data;
- local paper execution;
- artifact generation and CI;
- no wallet unlock.

Not authorized in this dry-run:

- any new chain write;
- new marketplace job;
- mainnet value movement;
- user capital;
- material paid spend;
- final observed-performance claims;
- merge to main;
- final submission.

## Dry-run PASS criteria

`SPONDEE_G5_GRID_OBSERVED_PAIR_IMPLEMENTATION_AND_DRY_RUN_REQUIRED = PASS` only when:

- backend tests and TypeScript pass;
- countability guard tests pass;
- external BNB/USD source is read successfully;
- at least 10 immutable observed rounds are preserved;
- agent and baseline outputs use the same snapshot/window/state;
- raw input/output/timing/cost/market artifacts are hashed and preserved;
- Grid trading record validates;
- pair validates structurally as OBSERVED;
- final report remains at zero countable pairs;
- static and runtime evidence prove no wallet, write, capital or realized-mainnet-PnL claim.
