# PBPD — Spondee Final Backend Complete / Frontend Handoff

**Audience:** Benita + frontend collaborators  
**Project:** Spondee — BNB Agent Studio / Build the Era  
**Canonical backend branch:** `build/backend-completion-final`  
**Backend status:** `CODE_COMPLETE_FOR_FRONTEND_V1`  
**Authoritative backend CI:** `33866229883` — PASS  
**Product authority:** `incoming/PRODUCT-REQUIREMENTS-DOCUMENT.md` remains canonical.  
**Technical frontend contract:** `backend/FRONTEND-CONTRACT.md`

---

## 1. Product definition

**Spondee** = **Calibrated Outcome Marketplace + Intervention Advantage**.

**Tagline:** **Agents, measured by what they deliver.**

Spondee is not primarily an agent directory and not a generic reputation leaderboard. The core product question is:

> **What did this agent promise for this task, what did it actually deliver, and how does that compare with doing the task without the agent?**

Canonical product journey:

`LAND → CATEGORY → AGENT → PROMISE_CARD → BOUNDED_ACTIVATE → OUTCOME_RECEIPT → PROMISE_VS_ACTUAL → AGENT_ADVANTAGE_WHEN_AVAILABLE`

Four first-class categories:

1. **Health Factor Monitoring** — hero category.
2. **Grid Trading**.
3. **Rebalancing**.
4. **Yield Optimisation**.

Health Factor may receive the strongest storytelling treatment, but the other three categories must use the same structural product language and comparable visual depth.

---

## 2. What the final product should make immediately understandable

A judge/user should be able to see:

1. **who the agent is** — identity/provenance;
2. **what it promises before activation** — expected outcome, downside, cost, timing, confidence status;
3. **what authority is being granted** — bounded mode/network/action;
4. **what actually happened** — Outcome Receipt;
5. **what kind of evidence it is** — SIMULATION vs OBSERVED;
6. **how the result compares to a baseline** where observed paired evidence exists;
7. **what is known vs unknown** without fabricated confidence/performance claims.

A good judge-retellable sentence is:

> “Spondee makes an agent promise an outcome before activation, records what actually happened, and compares it with a baseline.”

---

## 3. Backend implementation status — COMPLETE

The following backend areas are implemented and CI-validated.

### Marketplace/product core

- four category schemas;
- shared category/product metadata;
- controlled Spondee agent catalog;
- agent identity/provenance model;
- stable frontend bootstrap contract;
- deterministic task examples;
- Promise Card generation;
- Promise persistence;
- activation state model;
- Outcome Receipt generation/persistence;
- evidence storage;
- calibration summaries;
- Agent Advantage report aggregation.

### BSC / Agent Studio transport

All four controlled Spondee category paths have verified BSC-testnet live transport:

| Category | Verified job | Path status |
|---|---:|---|
| Health Factor Monitoring | 949 | PASS / closed |
| Grid Trading | 954 | PASS / closed |
| Rebalancing | 955 | PASS / closed |
| Yield Optimisation | 957 | PASS / closed |

These live transport proofs do **not** change their G3/G4 scenario receipts from SIMULATION to OBSERVED.

### Evidence / Agent Advantage

The backend supports:

- observed/simulation evidence records;
- observed-only Agent Advantage aggregation;
- observed-only calibration summaries;
- immutable evidence ingestion;
- individual evidence retrieval;
- strict separation between simulation and observed evidence.

Current countable evidence progress:

`1 / 3` required observed paired tasks.

First countable pair:

- category: Grid Trading;
- job: `962`;
- pair: `g5-grid-forward-job-962`;
- agent terminal equity: `$9,996.660009`;
- without-agent baseline: `$9,999.160009`;
- delta: `-$2.50`.

This unfavorable result is intentionally preserved. Spondee must never rewrite it as a performance win.

### Dynamic 8004scan discovery

Backend now uses a live server-side read-only integration with the official 8004scan API.

Endpoint:

`GET /v1/discovery/agents?search=&chain_id=&limit=`

Schema:

`spondee.8004scan-discovery.v1`

Rules:

- external agents remain `activatable: false`;
- discovery metadata does not imply performance;
- discovery metadata does not imply Spondee activation compatibility;
- optional 8004scan API key stays server-side;
- results are cached;
- controlled Spondee agents remain the dependable activation paths.

### Decision Replay

Implemented read-only:

`GET /v1/activations/:id/replay`

Schema:

`spondee.decision-replay.v1`

Replay reconstructs:

- task inputs;
- Promise Card;
- activation authority/mode/network;
- job and transaction references;
- Outcome Receipt;
- update/failure timeline.

It performs **no re-execution**.

### Production mutation safety

Consequential backend actions are now protected.

Server-only scopes:

- `SPONDEE_ACTION_TOKEN`
- `SPONDEE_EVIDENCE_INGEST_TOKEN`

Live action additionally requires:

- LIVE_TESTNET activation;
- retryable pre-write state only;
- runtime live gate;
- durable operation lock.

A state that has advanced to `CHAIN_FUNDED`, `CHAIN_SUBMITTED`, `COMPLETED` or `FAILED` is not blindly retried.

Evidence ingestion is immutable by `run_id`:

- identical retry → idempotent success;
- changed content under same ID → conflict;
- no silent overwrite of canonical evidence.

### Durable storage

- in-memory mode for local/CI;
- PostgreSQL mode for public deployment;
- Promise / Activation / Receipt / Evidence persistence;
- durable operation-lock table for concurrent live-action protection.

### Deployment readiness contract

Endpoint:

`GET /v1/runtime/backend-readiness`

Schema:

`spondee.backend-deployment-readiness.v1`

It separates:

- **backend code complete**;
- **runtime/public deployment configuration complete**.

Therefore a missing `DATABASE_URL` or public CORS origin does not mean more backend code is needed; it means deployment configuration is not yet finished.

---

## 4. Authoritative frontend contract

Benita should build from:

**Branch:** `build/backend-completion-final`

Primary endpoint:

`GET /v1/product/bootstrap`

Schema:

`spondee.frontend-bootstrap.v1`

The bootstrap should drive category navigation, agent states, demo task templates, capability display, evidence progress and readiness states.

### Read endpoints intended for frontend use

- `GET /healthz`
- `GET /v1/product/bootstrap`
- `GET /v1/categories`
- `GET /v1/agents`
- `GET /v1/agents/:id`
- `GET /v1/identity/:id`
- `GET /v1/discovery/agents`
- `GET /v1/promises`
- `GET /v1/promises/:id`
- `GET /v1/activations`
- `GET /v1/activations/:id`
- `GET /v1/activations/:id/replay`
- `GET /v1/receipts`
- `GET /v1/receipts/:id`
- `GET /v1/evidence/runs`
- `GET /v1/evidence/runs/:id`
- `GET /v1/evidence/agent-advantage`
- `GET /v1/agents/:id/calibration`
- `GET /v1/runtime/readiness`
- `GET /v1/runtime/backend-readiness`

### Normal browser-safe actions

- `POST /v1/promises/preview`
- `POST /v1/activations`

### Protected server-side actions

Do **not** put backend secrets in the browser.

- `POST /v1/activations/:id/live-testnet` requires server-only action authorization.
- `POST /v1/evidence/baselines` requires server-only evidence-ingestion authorization.

For public V1, Benita should either:

- keep live blockchain writes disabled in the judge-facing browser flow; or
- route the action through a trusted frontend server/BFF with its own user/session authorization.

---

## 5. Frontend V1 information architecture

Recommended five surfaces:

### A. Marketplace

- tagline;
- short mechanism statement;
- four categories;
- controlled agents;
- external discovery as secondary substrate;
- evidence/readiness labels.

### B. Agent / Promise

- selected agent;
- task configuration;
- network/provenance;
- bounded authority summary;
- Generate Promise action;
- Promise Card.

### C. Activation

- mode;
- network;
- price/cost;
- permission boundary;
- progress;
- blocked state;
- failure state;
- no hidden fallback to simulation when a live action is blocked.

### D. Outcome Receipt / Replay

- Promise ID;
- actual outcome;
- actual cost;
- evidence class;
- tx references;
- claim guardrail;
- Decision Replay link/timeline.

### E. Agent Advantage / Evidence

- paired-run progress (`1/3`, later `2/3`, `3/3`);
- agent vs baseline;
- measured time/cost/output deltas;
- evidence source/limitations;
- negative deltas shown honestly.

---

## 6. Hard frontend truth boundaries

These are product invariants.

- **SIMULATION ≠ OBSERVED.**
- Live BSC transport does not automatically make scenario evidence observed market evidence.
- **Paper PnL ≠ realized PnL.**
- **Verified identity ≠ verified performance.**
- **Verified activation path ≠ current write authority.**
- External 8004scan discovery ≠ Spondee activation compatibility.
- Failure ≠ valid negative outcome.
- Insufficient observed history ≠ confidence score.
- Negative Agent Advantage evidence remains valid evidence.
- No guaranteed return, safety or liquidation-prevention claim.

---

## 7. What remains after backend completion

These are **not missing backend-code percentages**. They are the remaining project workstreams.

### Evidence work

1. **Health Factor observed pair + event tape**
   - frozen position/rules;
   - warning timestamp;
   - intervention/recommendation timestamp;
   - adverse-event timestamp;
   - useful warning lead time;
   - response latency;
   - same-window baseline;
   - raw external provenance.

2. **Third countable observed pair**
   - same hardened pair contract;
   - no simulation promotion;
   - no post-hoc baseline construction.

### Runtime/deployment work

3. **Public backend deployment**
   - PostgreSQL `DATABASE_URL`;
   - `SPONDEE_CORS_ORIGINS`;
   - protected tokens;
   - public health/readiness smoke;
   - public judge-accessible evidence links.

4. **Frontend public deployment**
   - Benita implementation;
   - backend API URL;
   - CORS alignment;
   - no server token embedded in client code.

### Submission assurance

5. Winner Intelligence + TRACE judge-path pass.
6. Project Finisher.
7. Merge-to-main authorization.
8. Human final submission.

---

## 8. Winner Intelligence blind-spot overlay

Winner Intelligence should run **after Benita has a working V1**. It is a refinement layer, not a reason to redesign the backend.

Use four checks:

1. `SPONSOR_NATIVE_NECESSITY_CHECK`
2. `WHOLE_RUBRIC_COVERAGE_CHECK`
3. `NARRATIVE_AND_DEMO_LEGIBILITY_CHECK`
4. `JUDGE_PATH_LEGIBILITY_CHECK`

### WI-01 Sponsor-native necessity

Verify the judge can see why BSC / Agent Studio / ERC-8004 / ERC-8183 matter to the mechanism, not merely as badges.

Useful surfaces:

- provenance;
- verified testnet activation state;
- transaction evidence;
- bounded activation authority;
- Outcome Receipt.

### WI-02 Whole-rubric coverage

Evidence should be surfaced near the claim it supports.

The judge should be able to find:

- four-category product depth;
- live BSC activation proof;
- Promise Card;
- Outcome Receipt;
- Agent Advantage evidence;
- limitations;
- public readiness/failure semantics.

### WI-03 Narrative/demo legibility

The dominant visible sequence should remain:

`Configure → Promise → Activate → Progress → Receipt → Compare`

Do not turn V1 into a generic analytics dashboard that hides this sequence.

### WI-04 Judge-path legibility

Review the actual deployed frontend for:

- first 5-second core clarity;
- first 15-second progress clarity;
- signature action → visible consequence;
- truthful wait states;
- truthful failure states;
- rubric evidence surfacing;
- mobile geometry;
- keyboard flow;
- reduced-motion legibility.

Winner Intelligence must not introduce a fabricated win-probability score or “winning law”.

---

## 9. Backend completion proof

Authoritative CI:

`33866229883`

PASS coverage:

- full backend regression;
- strict TypeScript;
- four-category simulation truth smoke;
- protected mutation surfaces;
- Decision Replay;
- official 8004scan read-only integration;
- BSC-testnet read-only readiness;
- static no-mainnet-write guards;
- artifact upload.

Evidence file:

`evidence/backend-final-completion/README.md`

No blockchain write was performed by backend-completion CI.

---

## 10. Handoff rule

From this point onward, frontend V1 should **not require backend architecture changes**.

Allowed backend evolution while Benita works:

- new evidence records;
- Agent Advantage count changes (`1/3 → 2/3 → 3/3`);
- public deployment configuration;
- runtime URL changes;
- additive non-breaking fields.

Not allowed without explicit contract versioning:

- silently changing existing `spondee.frontend-bootstrap.v1` field meaning;
- removing established endpoints;
- converting external discovery agents into activatable agents without verified adapters;
- converting SIMULATION evidence into OBSERVED;
- exposing protected server tokens to browser code.

**Benita can start from this backend state.**
