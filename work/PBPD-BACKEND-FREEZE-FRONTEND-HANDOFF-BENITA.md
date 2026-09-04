# PBPD — Spondee Backend Freeze + Final Product / Frontend Handoff

**Audience:** Benita + frontend collaborators  
**Project:** Spondee — BNB Agent Studio / Build the Era  
**Branch:** `build/backend-product-freeze`  
**Status:** `BACKEND_PRODUCT_CONTRACT_FROZEN_PASS`  
**Authoritative CI:** `33864316044` + final handoff regression `33864582617` — PASS  
**Product authority:** `incoming/PRODUCT-REQUIREMENTS-DOCUMENT.md` remains canonical. This handoff is the implementation/frontend translation of that PRD; it does not replace it.

---

## 1. What Spondee is

**Tagline:** **Agents, measured by what they deliver.**

**Product concept:** **Calibrated Outcome Marketplace + Intervention Advantage**.

Spondee is not primarily an agent directory and not a generic reputation leaderboard. The product helps a user:

1. choose a financial task category;
2. see eligible agents and their BSC identity/capabilities;
3. inspect a task-specific **Promise Card** before activation;
4. understand bounded permissions, risk, timing and cost;
5. activate the agent through a bounded BSC path;
6. observe progress/outcome;
7. receive an **Outcome Receipt** binding Promise → Actual;
8. compare observed results against a reproducible without-agent baseline where evidence exists.

Canonical journey:

`LAND → CATEGORY → AGENT → PROMISE_CARD → BOUNDED_ACTIVATE → OUTCOME_RECEIPT → PROMISE_VS_ACTUAL → AGENT_ADVANTAGE_WHEN_AVAILABLE`

The four categories are first-class and must remain visually comparable:

- **Health Factor Monitoring** — hero category.
- **Grid Trading**.
- **Rebalancing**.
- **Yield Optimisation**.

---

## 2. What the final hackathon product should communicate

A judge should understand in seconds that Spondee answers a different question from a normal marketplace:

> **Not “Which agent has the best rating?” but “What did this agent promise for this task, what did it actually deliver, and how does that compare with doing the task without the agent?”**

The product must make five things visible:

1. **Agent identity / provenance** — BSC / 8004scan identity is a substrate, not proof of performance.
2. **Promise before action** — expected outcome, confidence status, downside/risk, cost, timing.
3. **Bounded authority** — what can happen, on what network, with what limits.
4. **Outcome Receipt** — actual result, cost, tx evidence where applicable, and truth class.
5. **Evidence quality** — SIMULATION vs OBSERVED must never be visually confused.

The product must remain truthful when evidence is unfavorable. The first countable Grid observed pair, job `962`, is intentionally preserved even though the agent underperformed its baseline on that window.

---

## 3. Backend status at handoff

### Backend core — implemented

- Four category schemas and demo task models.
- Marketplace catalog and agent records.
- 8004scan/ERC-8004 identity boundary.
- Promise Card generation and persistence.
- Activation records and bounded status model.
- Simulation Outcome Receipts.
- BSC-testnet ERC-8183 activation plumbing.
- MegaFuel-supported zero-price testnet path.
- Promise commitment / signed provenance protections.
- LocalStorage deliverable verification.
- Memory persistence for local/demo use.
- PostgreSQL persistence adapter for durable deployment.
- Evidence-run storage.
- Agent Advantage report aggregation.
- Calibration summary logic with simulation exclusion.
- Hardened observed-pair contract.
- Countability guardrails: historical replay and simulation cannot be silently promoted.
- First countable observed pair: Grid job `962`.
- Frontend bootstrap API.
- Frontend list APIs for Promises, Activations, Receipts and Evidence.
- Explicit CORS allowlist support via `SPONDEE_CORS_ORIGINS`.
- Catalog reconciliation: all four Spondee reference paths are marked `LIVE_TESTNET_VERIFIED`, while current write availability remains a separate runtime-gate field.

### Verified live transport

| Category | Verified job | Truth class of G3/G4 receipt | Status |
|---|---:|---|---|
| Health Factor Monitoring | 949 | SIMULATION | closed PASS |
| Grid Trading | 954 | SIMULATION | closed PASS |
| Rebalancing | 955 | SIMULATION | closed PASS |
| Yield Optimisation | 957 | SIMULATION | closed PASS |

### Observed Agent Advantage evidence

| Pair | Category | Countable | Measured result |
|---|---|---:|---|
| `g5-grid-forward-job-962` | Grid Trading | YES | agent terminal equity `$9,996.660009`; baseline `$9,999.160009`; agent underperformed by `$2.50` |

Current report status: **1 / 3 countable observed pairs**. The trading-related requirement is satisfied. Two more countable pairs are still required before final submission readiness.

---

## 4. Frontend contract Benita can use now

The backend exposes a stable bootstrap surface intended to let the frontend avoid duplicating product logic.

### Primary bootstrap

`GET /v1/product/bootstrap`

Returns:

- product name/tagline/concept;
- primary journey;
- ordered categories + presentation metadata;
- reference agents;
- all agents;
- demo task templates;
- backend capability matrix;
- runtime live-write readiness;
- Agent Advantage report;
- calibration summaries;
- canonical endpoint map;
- truth/countability rule.

### Read APIs

- `GET /healthz`
- `GET /v1/categories`
- `GET /v1/agents`
- `GET /v1/agents?category=...`
- `GET /v1/agents/:id`
- `GET /v1/identity/:id`
- `GET /v1/promises`
- `GET /v1/promises/:id`
- `GET /v1/activations`
- `GET /v1/activations/:id`
- `GET /v1/receipts`
- `GET /v1/receipts/:id`
- `GET /v1/evidence/runs`
- `GET /v1/evidence/agent-advantage`
- `GET /v1/agents/:id/calibration`
- `GET /v1/runtime/readiness`

### Write / action APIs

- `POST /v1/promises/preview`
- `POST /v1/activations`
- `POST /v1/activations/:id/live-testnet` — protected by runtime configuration; frontend must treat a closed gate as a truthful disabled/blocked state.
- `POST /v1/evidence/baselines` — evidence ingestion; not a judge-facing normal interaction.

### CORS

For a separately deployed frontend, backend production must set:

`SPONDEE_CORS_ORIGINS=https://<frontend-host>`

Comma-separated origins are supported. The backend does **not** use wildcard `*` by default.

---

## 5. Frontend V1 — what Benita should build first

Benita can start **before Winner Intelligence enhancements are implemented**.

### P0 judge path

1. **Landing**
   - Spondee tagline.
   - one-sentence product mechanism.
   - four category cards at equal visual depth.
   - Health Factor highlighted as hero, not as the only complete product.

2. **Category view**
   - task purpose;
   - eligible agent(s);
   - activation proof badge (`VERIFIED_LIVE_TESTNET` vs `UNVERIFIED_EXTERNAL`);
   - capabilities;
   - evidence status.

3. **Agent view / task configuration**
   - task inputs;
   - network;
   - risk/authority boundaries;
   - “Generate Promise” action.

4. **Promise Card**
   - expected outcome;
   - confidence status (may be UNSCORED — do not invent a number);
   - expected downside;
   - expected cost;
   - timing;
   - claim guardrail;
   - visible SIMULATION / OBSERVED_PENDING / OBSERVED distinction.

5. **Bounded Activate**
   - current runtime readiness;
   - price/cost;
   - network;
   - permission boundary;
   - explicit blocked state when live gate is closed;
   - progress steps during long operations.

6. **Outcome Receipt**
   - Promise ID / scenario ID;
   - actual outcome;
   - actual cost;
   - transaction hashes / explorer affordance where applicable;
   - evidence class;
   - calibration eligibility;
   - claim guardrail.

7. **Agent Advantage**
   - observed pair count `1/3` initially;
   - agent vs without-agent baseline;
   - time / cost / output-quality dimensions;
   - show negative deltas honestly;
   - Grid job 962 is a good initial real evidence card because it proves that Spondee does not hide an unfavorable result.

### P0 interaction principle

The main visible action should have a clear visible consequence:

`Configure task → Generate Promise → Activate → See progress → See Receipt → Compare evidence`

Avoid burying this sequence in dashboards or multiple disconnected pages.

---

## 6. Truth boundaries the frontend must preserve

These are hard product rules, not optional copy choices.

- **SIMULATION ≠ OBSERVED.**
- Live BSC transport alone does not turn a simulated scenario into observed market evidence.
- 8004scan identity/capability data does not prove Spondee activation or performance.
- A negative Agent Advantage result is still valid evidence.
- Paper trading is not realized PnL.
- Spondee must not promise guaranteed returns, safety or liquidation prevention.
- When confidence history is insufficient, show “insufficient observed history / unscored”, not a fabricated percentage.
- A closed runtime write gate should look **blocked/disabled with explanation**, not broken and not silently simulated.
- Failure must remain visually distinct from a valid negative outcome.

---

## 7. Backend/evidence work that remains after this frontend freeze

These remaining items should **not block Benita from starting V1**.

### Evidence workstreams still open

1. **Health Factor observed pair + event tape**
   - warning timestamp;
   - useful warning lead time;
   - intervention/recommendation timestamp;
   - response latency;
   - adverse-event timestamp;
   - same-window without-agent baseline;
   - raw observed provenance.

2. **Third countable observed pair**
   - category can be selected based on strongest evidence opportunity/capacity;
   - must use same-window raw baseline and hardened countability contract.

3. **Public deployment**
   - backend public URL;
   - PostgreSQL or other durable runtime configuration;
   - frontend origin allowlist;
   - health/readiness smoke;
   - judge-accessible evidence links.

### Backend blind spots to verify before submission

- production database migrations/backups and deployment env correctness;
- actual public CORS origin configured;
- public API rate/failure behavior under judge interaction;
- long-running activation UX/polling behavior under real latency;
- persistence of observed-pair artifacts in a judge-accessible location rather than local temp paths;
- dynamic 8004scan discovery refresh is still partial; external agents remain discovery-only until adapters are independently verified;
- Decision Replay is not yet a submission blocker but remains a useful evidence affordance;
- final visible delegated-authority controls need frontend treatment even though backend gates fail closed.

---

## 8. Winner Intelligence — blind-spot overlay, not a frontend blocker

Winner Intelligence is used here as a bounded **pre-submission heuristic**, not as a prediction engine and not as a source of “winning laws”. It must not override product truth or submission authority.

The surviving Winner Intelligence checks are:

1. `SPONSOR_NATIVE_NECESSITY_CHECK`
2. `WHOLE_RUBRIC_COVERAGE_CHECK`
3. `NARRATIVE_AND_DEMO_LEGIBILITY_CHECK`
4. `JUDGE_PATH_LEGIBILITY_CHECK` — v1.1 design extension.

For Spondee, these translate into the following frontend blind spots.

### WI-01 — Sponsor-native necessity

**Question:** Does the product visibly need BNB/Agent Studio/BSC mechanics, or could the demo look like a generic dashboard with blockchain badges?

Frontend implication:
- show network/provenance at the moments where it matters;
- show the bounded activation and receipt/transaction evidence;
- do not overload every screen with sponsor logos or protocol jargon.

### WI-02 — Whole-rubric evidence coverage

**Question:** Is each material judge criterion backed by evidence and can the judge find it?

Frontend implication:
- evidence badges and links near the claim they support;
- 4/4 category depth visible;
- Agent Advantage progress visible (`1/3`, later `3/3`);
- public limitations visible rather than hidden in documentation.

### WI-03 — Narrative + demo legibility

**Question:** Can a judge retell the product after seeing it once?

Target retellable sentence:

> “Spondee makes an agent promise an outcome before activation, records what actually happened, and compares it with a baseline.”

Frontend implication:
- keep the Promise → Activate → Receipt → Compare sequence dominant;
- reduce dashboard density if it obscures this mechanism.

### WI-04 — Judge-path legibility

This is the highest-value post-V1 enhancement layer.

Check explicitly:

- **first 5 seconds:** problem + core mechanism understandable;
- **first 15 seconds:** if something is waiting/running, progress is clear and truthful;
- **signature action:** one meaningful action exists;
- **action → visible consequence:** the user immediately understands what changed;
- **rubric evidence surfacing:** evidence exists *and* the judge can encounter it in the likely path;
- **truthful waiting state:** show what is known, pending and blocked;
- **truthful failure state:** failure never becomes fake success;
- mobile geometry;
- keyboard navigation;
- reduced-motion legibility.

### Winner Intelligence implementation order

**Benita V1 should not wait for this analysis.**

Recommended sequencing:

1. Benita builds the stable V1 journey from this handoff.
2. Integrate and smoke-test against `/v1/product/bootstrap`.
3. Run a Winner Intelligence / TRACE pass on the working frontend.
4. Patch only demonstrated blind spots — especially first-view clarity, progress/wait states, evidence placement and action→consequence.
5. Do not reopen broad winner research unless a real contradiction is observed.

Winner Intelligence must **not** introduce:
- a win-probability score;
- fabricated competitor rules;
- automatic score/weight changes;
- a requirement to redesign the product before Benita can start.

---

## 9. Recommended information architecture

A compact frontend can use five primary surfaces:

1. **Marketplace** — 4 categories + agents.
2. **Agent / Promise** — configure and inspect Promise Card.
3. **Activation** — authority + progress + failure/wait state.
4. **Receipt** — Promise vs Actual with evidence.
5. **Evidence / Agent Advantage** — paired comparisons, calibration history, limitations.

Health Factor can have the strongest demo treatment, but Grid/Rebalancing/Yield should reuse the same structural language and card hierarchy.

---

## 10. What is intentionally not required for Benita V1

- meaningful mainnet user capital;
- real-money trading;
- Altana/session-key expansion;
- PancakeSwap bonus work;
- generic reputation scoring;
- winner-prediction scoring;
- full Decision Replay;
- multiple external-agent activation adapters;
- final submission packaging.

These can be added only if core evidence, public deployment and judge path are already healthy.

---

## 11. Definition of “backend frozen for frontend”

The backend is **frontend-contract frozen** because CI has confirmed:

- tests pass;
- strict TypeScript passes;
- `/v1/product/bootstrap` contract passes;
- four verified Spondee agent activation-proof records are present;
- list APIs pass;
- CORS allowlist regression passes;
- no existing G3/G4/G5 closed job is mutated;
- no new blockchain write is performed by this backend-freeze branch.

Future observed-pair evidence may change **data/progress values** (`1/3 → 2/3 → 3/3`) without requiring a frontend architecture rewrite.

---

## 12. Handoff rule for Benita

Benita should build against:

**Branch:** `build/backend-product-freeze`

Primary API contract:

`GET /v1/product/bootstrap`

Do not hardcode assumptions that:
- all evidence is positive;
- all agents are writable at every moment;
- observed pair count stays at 1;
- confidence always exists;
- external 8004scan agents are activatable.

The frontend should tolerate these backend states changing while preserving the same UI model.

---

## 13. Current next workstreams after handoff

Backend/product evidence team:

`HEALTH_FACTOR_OBSERVED_PAIR + EVENT_TAPE → THIRD_OBSERVED_PAIR → PUBLIC_DEPLOYMENT → WINNER_INTELLIGENCE/TRACE JUDGE-PATH PASS → PROJECT FINISHER → HUMAN SUBMISSION`

Frontend team can proceed in parallel from V1 immediately.
