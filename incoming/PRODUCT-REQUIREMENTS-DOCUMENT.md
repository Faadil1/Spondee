# Spondee — Product Requirements Document

Version: `0.1`  
Status: `PRD_DRAFTED`  
Project ID: `bnb_agent_studio_build_the_era_2026`  
Date: `2026-09-03`  
Owner: `PBPD`  
Authorization source: `incoming/CHIEF-OF-STAFF-AUTHORIZATION.yaml`

> This PRD cannot expand project authority beyond the authorization artifact.

## 1. Product summary

**Spondee** is a marketplace for live BSC agents where users compare agents using **task-specific measurable promises rather than generic ratings**. Before hiring an agent, Spondee shows what that agent expects to achieve for the specific job: expected outcome, confidence/probability, expected downside/risk bound, expected cost, and expected execution/intervention timing. After the job, Spondee creates an **Outcome Receipt** comparing `PROMISE -> ACTUAL OUTCOME -> CALIBRATION`, and where a baseline exists, `AGENT OUTCOME -> WITHOUT-AGENT OUTCOME -> AGENT ADVANTAGE`.

For time-sensitive tasks, Spondee adds **Intervention Advantage**: signed warnings are evaluated by useful lead time, accuracy, confidence calibration and actionability.

## 2. Target user / stakeholder

Primary user: a DeFi user who wants an autonomous agent to manage or protect capital on BNB Chain but cannot confidently determine which agent is appropriate for the specific task.

Secondary stakeholders: BNB Agent Studio ecosystem participants, agent developers, liquidity providers, traders, lending users, TermiX evaluators, Altana evaluators and BNB Chain judges.

## 3. Job-to-be-done

> When I need an autonomous agent to perform a financial task on BNB Chain, I need to understand what each eligible agent expects to accomplish, what risk/cost it expects, and how reliable its past promises have been, so that I can hire an agent without relying on marketing claims or generic reputation.

For time-critical situations:

> When my capital may soon require intervention, I need to know which agent can detect the condition early enough, accurately enough and cheaply enough for action still to be useful.

## 4. Problem / evidence

Problem: existing discovery infrastructure can identify an agent, capability and reputation, but does not fully answer: **“Is this agent likely to create value for my specific task, under my current conditions?”**

Evidence:
- BNB Chain requires a marketplace where users can find, understand and activate agents, with sufficiently useful data for hiring decisions.
- TermiX requires measured agent-vs-without-agent comparisons with time, cost, quality and actual outputs.
- 8004scan already provides identity, capabilities, ownership, reputation, feedback and network data; duplicating these is not the product opportunity.

Truth classes:
- FACT: four categories are required; activatable agents must be live on BSC; TermiX requires at least three real comparisons and at least one trading/stock/security task.
- INFERENCE: task-specific calibrated promises can provide more decision value than generic ratings alone.
- HYPOTHESIS: judges/users will understand a Promise Card quickly; Intervention Advantage can create a memorable hero moment without weakening four-category depth.
- UNVERIFIED: exact reference agents; exact external API behavior; final Agent Studio/8004scan/Altana integration complexity.

## 5. Goals

- G1 — Enable find -> understand -> activate in all four official categories.
- G2 — Show a task-specific Promise Card before activation.
- G3 — Generate an Outcome Receipt after execution/observation.
- G4 — Produce at least three real agent-vs-without-agent experiments.
- G5 — Maintain comparable depth across Rebalancing, Grid Trading, Yield Optimisation and Health Factor Monitoring.
- G6 — Make delegated execution limits understandable and visible.

## 6. Non-goals

Spondee is not a replacement for 8004scan, generic ERC-8004 directory, generic reputation marketplace, RFQ/reverse-auction system, insurance/bond protocol, tournament/league, generic multi-agent orchestrator, general backtesting engine, generic red-team platform or prediction market. It does not guarantee financial return or safety.

## 7. Primary Path

```text
LAND
-> choose one of 4 categories
-> see eligible live BSC agents
-> select an agent
-> configure bounded task
-> inspect Promise Card
-> inspect permissions / cost
-> activate agent
-> observe execution or monitoring window
-> receive Outcome Receipt
-> compare PROMISE vs ACTUAL
-> inspect observed Agent Advantage where baseline exists
```

## 8. Hero Demo Moment

Starting state: a lending position with defined Health Factor floor and reproducible adverse market scenario. The selected agent shows confidence, expected warning lead time, expected response latency, cost and bounded authority.

Judge/user action: select and activate the Health Factor agent.

Observable sequence:

```text
WARNING ISSUED
-> USEFUL LEAD TIME
-> ACTION / INTERVENTION
-> ADVERSE EVENT
-> OUTCOME RECEIPT
```

Proof: promise timestamp, signed forecast/warning, event timestamp, intervention timestamp, BSC transaction hash where applicable, actual HF outcome, actual cost, lead time, calibration result and baseline comparison when applicable.

Internal demo target: core hero path understandable in approximately 60–90 seconds. This is not an official video-limit claim.

Reset/replay: use the same frozen scenario ID and identical initial state.

## 9. Functional requirements

### MUST

| ID | Requirement | Acceptance evidence |
|---|---|---|
| MUST-01 | Surface all four official categories at equal product depth | Judge-path checklist |
| MUST-02 | Anything shown as activatable is a real BSC-live agent/path | Agent IDs + BSC evidence |
| MUST-03 | Reuse 8004scan identity/capability data | Data provenance |
| MUST-04 | Produce a task-specific Promise Card before activation | Stored promise artifact |
| MUST-05 | Promise Card includes expected outcome, confidence, downside/risk, price and relevant timing | Schema validation |
| MUST-06 | Category -> successful activation has no dead end | E2E test |
| MUST-07 | Delegated authority is visibly bounded | Allowlist/cap/expiry/revoke evidence |
| MUST-08 | Every measured completed run creates an Outcome Receipt | Receipt artifact |
| MUST-09 | Receipt binds original promise to actual result | Promise/result IDs |
| MUST-10 | Agent Advantage Report contains at least 3 observed paired tasks | Final report + raw outputs |
| MUST-11 | At least one measured task is trading-related | Grid Trading experiment |
| MUST-12 | Baseline timings/costs/results are observed or reproducible, never invented | Raw baseline artifacts |
| MUST-13 | Health Factor hero measures useful warning lead time and response latency | Event tape |
| MUST-14 | Public product remains accessible during judging | Public URL smoke check |
| MUST-15 | Failure states fail visibly rather than fabricating success | Negative-path test |

### SHOULD

| ID | Requirement | Acceptance evidence |
|---|---|---|
| SHOULD-01 | Show calibration history when enough runs exist | Historical receipts |
| SHOULD-02 | Provide Decision Replay for measured runs | Replay screen |
| SHOULD-03 | Use Altana scoped session authority if core integration supports it | Explorer + UI evidence |
| SHOULD-04 | Provide genuine PancakeSwap benefit through Grid or LP-range management if core product is already complete | Protocol interaction |
| SHOULD-05 | Keep generic reputation secondary to task-specific evidence | UI hierarchy review |

### MAY

- MAY-01 — User-owned Safety Envelope across agents.
- MAY-02 — Second Health Factor agent for comparative calibration.
- MAY-03 — Failure-envelope/adversarial evidence.
- MAY-04 — Reserved execution-capacity information.

### MUST_NOT

- MUST_NOT-01 — Present estimated/synthetic performance as observed real evidence.
- MUST_NOT-02 — Build custom identity/reputation infrastructure duplicating 8004scan.
- MUST_NOT-03 — Claim guaranteed profit, safety or liquidation prevention.
- MUST_NOT-04 — Show an agent as activatable when activation does not work.
- MUST_NOT-05 — Make Health Factor substantially deeper than the other three marketplace categories.
- MUST_NOT-06 — Add bonds, auctions, leagues, generic red-team systems or orchestration platforms before core gates pass.
- MUST_NOT-07 — Move meaningful real mainnet user capital without explicit human authorization.
- MUST_NOT-08 — Treat LLM-generated quality scores as ground truth.

## 10. Non-functional requirements

- NFR-01 Reliability — critical judge journey repeatable without unrecoverable error.
- NFR-02 Reproducibility — immutable scenario/run IDs with preserved raw evidence.
- NFR-03 Performance — long blockchain operations show explicit progress; normal navigation remains interactive.
- NFR-04 Safety — permission scopes and capital bounds fail closed.
- NFR-05 Evidence integrity — material claims link to raw artifacts/receipts.
- NFR-06 Maintainability — shared Promise/Receipt schemas across categories.
- NFR-07 Public availability — deployment remains accessible during judging.

## 11. Success metrics

Primary: `4/4 official categories complete FIND -> UNDERSTAND -> ACTIVATE without a dead end.`

Supporting:
- `3/3 required Agent Advantage experiments complete with actual outputs and observed baselines.`
- `100% of material performance claims shown in final submission map to preserved evidence.`
- At least one trading experiment has a real performance record including evaluation window and risk/outcome information.
- If Altana is pursued, at least one real session-key transaction is visible with user-facing limits and revoke control.

Failure/stop: pivot if fewer than four categories have credible activation paths, core evidence requires fake/synthetic performance presented as real, Promise Cards cannot be populated meaningfully, Agent Advantage cannot be collected reproducibly, the product collapses into a conventional directory/ratings UI, or judging availability cannot be maintained.

## 12. Acceptance criteria

Build-ready when:
- authorized scope matches PRD;
- all material MUST requirements have evidence plans;
- Promise Card schema is frozen;
- Outcome Receipt schema is frozen;
- Health Factor G3 scenario is defined;
- at least one viable BSC-live reference agent/path is identified for the initial vertical;
- unresolved integrations are bounded reconnaissance issues, not product-definition blockers;
- PBPD reconciles PRD into canonical state.

Submission-ready when:
- all four category journeys pass;
- material MUST requirements are verified;
- at least three observed Agent Advantage comparisons exist;
- one comparison is trading-related;
- claims/evidence reconcile;
- public deployment is healthy;
- required report exists;
- limitations are visible;
- Project Finisher reaches `SUBMISSION_READY`;
- human performs protected submission.

## 13. Evidence plan

| Claim | Required proof | Planned artifact | Status |
|---|---|---|---|
| Agent is live on BSC | Network/identity/activity evidence | Agent record | PENDING |
| User can activate agent | Successful E2E interaction | Activation receipt / tx | PENDING |
| Promise predates outcome | Timestamped record | Promise JSON/hash | PENDING |
| Agent produced stated result | Onchain/output evidence | Outcome Receipt | PENDING |
| Agent beats baseline | Controlled paired runs | Advantage experiment bundle | PENDING |
| Health warning was useful | Warning + event timestamps | Event tape | PENDING |
| Cost advantage is real | Actual costs | Cost ledger | PENDING |
| Calibration is measured | Forecast + observed result | Calibration record | PENDING |
| Altana limits are real | Onchain session configuration | Explorer + UI capture | PENDING |
| Four categories have equal depth | Shared structural journey | Rubric coverage test | PENDING |

## 14. Constraints

Deadline: `2026-09-09 UTC`; exact cutoff hour remains unverified.

Budget: no new material paid-spend authority. Material spend requires human authorization.

Platforms: BNB Smart Chain, BNB Agent Studio, 8004scan, BSC testnet initially, Altana where qualification-worthy, PancakeSwap/Venus where appropriate.

Environment: public web product during judging; preserved scenario/experiment evidence.

Evaluator constraint: `land -> find -> understand -> activate`, with useful data and comparable depth across all four categories.

## 15. Authority / safety / protected actions

Permitted: build/test Spondee, use BSC testnet, integrate public/authorized APIs/SDKs, create test/reference agents, collect evidence, deploy a public judging build, perform bounded implementation reconnaissance.

Prohibited without new authority: meaningful real user/mainnet funds, material paid spend, legal/financial guarantees, secret exposure, unsupported return/safety claims, material objective expansion.

Protected/human-gated: final hackathon submission, material mainnet-capital action, material paid spend, unsupported public claims.

## 16. Assumptions / killing assumptions

| ID | Assumption | Truth class | Test | Kill/pivot condition |
|---|---|---|---|---|
| A-01 | At least one usable live BSC agent/path exists for each category | HYPOTHESIS | 8004scan + activation probe | Any category has no credible path |
| A-02 | Task-specific promises can be produced before activation | HYPOTHESIS | G3 Promise Card probe | Only generic/static marketing data available |
| A-03 | Promise -> actual can be bound reliably | HYPOTHESIS | Complete vertical run | Ordering/provenance cannot be proven |
| A-04 | Health Factor can produce a credible intervention demo | HYPOTHESIS | Deterministic stress run | No reproducible event/action timing |
| A-05 | Users/judges understand confidence fields quickly | HYPOTHESIS | Judge-readability review | Requires lengthy explanation |
| A-06 | TermiX baselines can be recorded before deadline | HYPOTHESIS | First paired experiment | Operationally infeasible |
| A-07 | Intervention Advantage need not apply identically to all categories | INFERENCE | Category review | Forced implementation harms coherence |

## 17. Risks / failure modes

- R-01 CRITICAL — scope exceeds Sep 9 capacity; mitigation: freeze MVP.
- R-02 CRITICAL — four-category depth becomes cosmetic; mitigation: shared schemas + category acceptance tests.
- R-03 HIGH — Health hero dominates product; mitigation: explicitly demonstrate other categories.
- R-04 HIGH — confidence values are meaningless; mitigation: track calibration and label insufficient history.
- R-05 HIGH — baseline comparison is biased; mitigation: same state/window and preserved raw data.
- R-06 HIGH — external agent/API instability; mitigation: reference-agent fallback and explicit failure state.
- R-07 MEDIUM — Altana consumes core build time; mitigation: Main + TermiX first.
- R-08 HIGH — financial language implies guarantee; mitigation: forecast/probability/outcome language and limitations.
- R-09 HIGH — JigJoy/Syndicate collision consumes build capacity; mitigation: strict narrow vertical and gate sequencing.

## 18. Dependencies

External: BNB Chain, Agent Studio, 8004scan, Altana and relevant BSC DeFi protocols.

Repository: `Faadil1/Spondee`.

Model/provider: not authority-critical; deterministic/onchain evidence owns measured outcomes.

Data: 8004scan agent records, BSC/protocol state, frozen experiment fixtures/scenarios.

Human: observed manual/no-agent baselines and protected final submission.

## 19. Open questions

- Q1 — Which live BSC agent/path is fastest and most credible for G3?
- Q2 — Which Promise Card fields come directly from 8004scan versus task-time agent output?
- Q3 — Which Health Factor protocol/scenario provides the cleanest reproducible intervention path?
- Q4 — Can Altana scoped activation be included in G3 without jeopardizing the core vertical?
- Q5 — What is the simplest truthful metric set for Yield Optimisation?

These are implementation reconnaissance questions. They must be resolved or explicitly bounded before `PRD_READY` where they affect consequential architecture.

## 20. Completion / submission boundary

PBPD terminal boundary: `BUILD_CANDIDATE_READY` or `BUILD_CANDIDATE_READY_WITH_LIMITATIONS`.

External final action owner: `human`.

Project Finisher owns `SUBMISSION_READY`.

## 21. Hackathon additions

Official rubric surfaces: Functionality, Data Quality, Agent Diversity.

Spondee mapping:
- Functionality -> Find -> Promise Card -> bounded Activate -> Outcome Receipt.
- Data Quality -> forecast, confidence, downside, cost, timing, actual outcome and calibration.
- Agent Diversity -> same structural framework across all four required categories.

TermiX: at least three real paired tasks with time, cost, output quality and actual outputs; at least one trading/stock/security task.

Altana target if pursued: real scoped session, allowlist, spend cap, expiry, onchain registration, session-key transaction and user-visible revoke.

PancakeSwap target only after core gates pass and only through real trader/LP value.

Video/demo time limit: `UNVERIFIED` — do not invent one.

IP/provenance: competition-specific code belongs here; do not copy reusable PBPD/TRACE/HOI/Project Finisher/Faadil Agent System internals into the submission; label synthetic/demo data; distinguish simulations from observed performance.

## 22. Version / scope-change history

| Version | Date | Change | Authority / reason |
|---|---|---|---|
| 0.1 | 2026-09-03 | Initial Spondee PRD after human GO, blind council, collision analysis and naming lock | Human authorization + PBPD pre-build standard |

## PRD_READY declaration

Current status remains `PRD_DRAFTED`.

Advance only after PBPD validates this document and reconciles requirements, authority, evidence, risks, decisions, artifacts and activity into `.pbpd/state/`.
