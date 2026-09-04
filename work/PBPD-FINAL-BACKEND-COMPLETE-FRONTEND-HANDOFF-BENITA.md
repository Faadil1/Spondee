# PBPD — Spondee Final Backend + Evidence Complete / Frontend Handoff

**Audience:** Benita + frontend collaborators  
**Project:** Spondee — BNB Agent Studio / Build the Era  
**Canonical frontend source branch:** `build/frontend-handoff-ready`  
**Backend status:** `CODE_COMPLETE_FOR_FRONTEND_V1`  
**Observed evidence:** `AGENT_ADVANTAGE_READY_3_OF_3`  
**Health Factor event tape:** `CLOSED_PASS`  
**Authoritative backend CI:** `33867168666` — PASS  
**Observed-closure preflight:** `33868671297` — PASS  
**Deployment contract preflight:** `33869418246` — PASS  
**Product authority:** `incoming/PRODUCT-REQUIREMENTS-DOCUMENT.md` remains canonical.  
**Technical frontend contract:** `backend/FRONTEND-CONTRACT.md`

---

## 1. Product definition

**Spondee** = **Calibrated Outcome Marketplace + Intervention Advantage**.

**Tagline:** **Agents, measured by what they deliver.**

Spondee is not primarily an agent directory and not a generic reputation leaderboard. Its core question is:

> **What did this agent promise for this task, what did it actually deliver, and how does that compare with doing the task without the agent?**

Canonical journey:

`LAND → CATEGORY → AGENT → PROMISE_CARD → BOUNDED_ACTIVATE → OUTCOME_RECEIPT → PROMISE_VS_ACTUAL → AGENT_ADVANTAGE`

Four first-class categories:

1. **Health Factor Monitoring** — hero category.
2. **Grid Trading**.
3. **Rebalancing**.
4. **Yield Optimisation**.

Health Factor may receive the strongest storytelling treatment, but the other categories must use the same structural product language and comparable visual depth.

---

## 2. What the final product must make immediately understandable

A judge/user should be able to see:

1. who the agent is — identity/provenance;
2. what it promises before activation;
3. what authority is being granted;
4. what actually happened;
5. whether the evidence is SIMULATION or OBSERVED;
6. how the observed result compares with a precommitted without-agent baseline;
7. what is known, unknown, negative or neutral without fabricated confidence/performance claims.

Retellable sentence:

> “Spondee makes an agent promise an outcome before activation, records what actually happened, and compares it with a baseline.”

---

## 3. Backend implementation — COMPLETE

The backend is code-complete for frontend V1.

Implemented and CI-validated:

- four category schemas and shared product metadata;
- controlled Spondee agent catalog;
- Promise Card generation/persistence;
- Activation and Outcome Receipt state/persistence;
- BSC-testnet ERC-8183 activation plumbing;
- MegaFuel zero-price testnet path;
- evidence storage and immutable ingestion;
- observed-only Agent Advantage aggregation;
- calibration summaries;
- durable PostgreSQL operation locks;
- protected live-action and evidence-ingestion surfaces;
- Decision Replay (`spondee.decision-replay.v1`);
- official 8004scan server-side read-only discovery (`spondee.8004scan-discovery.v1`);
- backend deployment-readiness contract (`spondee.backend-deployment-readiness.v1`);
- stable frontend bootstrap (`spondee.frontend-bootstrap.v1`).

All four controlled category transport paths have verified BSC-testnet live execution:

| Category | Verified job | Status |
|---|---:|---|
| Health Factor Monitoring | 949 | PASS / closed |
| Grid Trading | 954 | PASS / closed |
| Rebalancing | 955 | PASS / closed |
| Yield Optimisation | 957 | PASS / closed |

G3/G4 scenario receipts remain **SIMULATION**. Live transport alone does not promote them to OBSERVED.

---

## 4. Observed Agent Advantage — COMPLETE 3 / 3

The required observed paired evidence is complete before frontend work begins.

| Category | Job | Pair | Countable | Measured result |
|---|---:|---|---:|---|
| Grid Trading | 962 | `g5-grid-forward-job-962` | YES | Agent `$9,996.660009` vs baseline `$9,999.160009`: **-$2.50** |
| Health Factor Monitoring | 971 | `g5-health-forward-job-971` | YES | warning lead **95.829 s**, response latency **0 ms**, no adverse event observed |
| Rebalancing | 973 | `g5-rebalancing-forward-job-973` | YES | **neutral**: both agent and baseline `$10,002.727008` |

Final status:

- countable observed pairs: **3 / 3**;
- trading-related requirement: **satisfied** by Grid job 962;
- Health Factor timing/event-tape requirement: **satisfied** by job 971;
- aggregate evidence status: **READY**.

Canonical aggregate:

`evidence/g5-agent-advantage-3-of-3-final/README.md`

### Truth-preserving interpretation

This evidence does **not** say agents always outperform baselines.

- Grid job 962 is a real preserved **negative** result.
- Health job 971 demonstrates measured warning timing under a frozen protocol, not guaranteed liquidation prevention.
- Rebalancing job 973 is a real preserved **neutral** result.

This honesty is part of Spondee’s product mechanism.

---

## 5. Health Factor hero event tape — CLOSED

Health job `971`:

- 6 future Chainlink BNB/USD rounds;
- warning lead time: `95.829 s`;
- response latency: `0 ms`;
- adverse event observed: `false`;
- liquidation prevention claimed: `false`;
- mainnet value moved: `false`.

Frontend wording should emphasize:

> **Measured early-warning timing under the frozen observed protocol.**

Do **not** say:

- “prevented liquidation”;
- “guaranteed safety”;
- “always warns 95 seconds earlier”.

---

## 6. Authoritative frontend contract

Benita should build from:

**Branch:** `build/frontend-handoff-ready`

Primary endpoint:

`GET /v1/product/bootstrap`

Schema:

`spondee.frontend-bootstrap.v1`

The bootstrap should drive category navigation, agent states, demo task templates, capability display, evidence progress and readiness states.

### Read endpoints

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

### Browser-safe actions

- `POST /v1/promises/preview`
- `POST /v1/activations`

### Protected server-side actions

- `POST /v1/activations/:id/live-testnet` — server-only action authorization.
- `POST /v1/evidence/baselines` — server-only evidence-ingestion authorization.

Never place `SPONDEE_ACTION_TOKEN` or `SPONDEE_EVIDENCE_INGEST_TOKEN` in browser code.

---

## 7. Benita scope — frontend + public deployment

Benita owns:

1. frontend V1;
2. Vercel project/deployment;
3. backend public deployment using the existing adapter/config;
4. database connection;
5. server environment variables;
6. CORS alignment;
7. public smoke tests.

Existing deployment assets:

- `api/index.mjs`
- `vercel.json`
- deployment contract preflight `33869418246` — PASS.

Required production environment:

- `DATABASE_URL`
- `SPONDEE_CORS_ORIGINS`
- `SPONDEE_ACTION_TOKEN`
- `SPONDEE_EVIDENCE_INGEST_TOKEN`

Optional:

- `SPONDEE_8004SCAN_API_KEY`

The two protected tokens are **server-only**.

A separately hosted frontend must configure `SPONDEE_CORS_ORIGINS` to the real frontend origin.

Do not silently reuse an unrelated project database or secret store without explicit approval.

---

## 8. Recommended frontend V1 information architecture

### A. Marketplace

- tagline + one-sentence mechanism;
- four categories;
- controlled agents;
- external discovery as secondary substrate;
- live-path and evidence labels.

### B. Agent / Promise

- selected agent;
- task configuration;
- provenance;
- bounded authority;
- Generate Promise;
- Promise Card.

### C. Activation

- mode;
- network;
- cost;
- permission boundary;
- progress/waiting;
- blocked state;
- failure state;
- no hidden fallback from failed live action to simulation.

### D. Outcome Receipt / Replay

- Promise vs Actual;
- actual cost;
- evidence class;
- tx references;
- claim guardrail;
- Decision Replay timeline.

### E. Agent Advantage

Show all three preserved observed outcomes, not only favorable evidence:

- Grid — negative;
- Health — timing advantage;
- Rebalancing — neutral.

This is stronger product evidence than a cherry-picked leaderboard.

---

## 9. Hard frontend truth boundaries

- **SIMULATION ≠ OBSERVED.**
- **Paper PnL ≠ realized PnL.**
- **Verified identity ≠ verified performance.**
- **Verified activation path ≠ currently-open write authority.**
- External 8004scan discovery ≠ activation compatibility.
- Failure ≠ negative or neutral measured outcome.
- A negative or neutral pair is valid evidence.
- Insufficient history ≠ confidence score.
- Health warning lead ≠ liquidation-prevention guarantee.
- No guaranteed returns, profit or safety.

---

## 10. Raw observed bundle preservation

The public summaries for jobs 971 and 973 are canonicalized in GitHub, but their raw runner bundles were produced under Windows `%TEMP%`.

Before local temp cleanup, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\archive-g5-pre-frontend-evidence.ps1
```

The script:

- copies Health 971 raw evidence into its evidence directory;
- copies Rebalancing 973 raw evidence into its evidence directory;
- fails closed if the destination already exists;
- performs a basic sensitive-material marker scan;
- creates an archive manifest;
- does **not** git-add, commit or push automatically.

This archive is for reproducibility/submission packaging and does not block Benita from starting frontend V1.

---

## 11. Winner Intelligence — after working frontend + public smoke

Winner Intelligence is a bounded review layer, not a backend dependency and not a win predictor.

Run after Benita has a working deployed V1:

1. `SPONSOR_NATIVE_NECESSITY_CHECK`
2. `WHOLE_RUBRIC_COVERAGE_CHECK`
3. `NARRATIVE_AND_DEMO_LEGIBILITY_CHECK`
4. `JUDGE_PATH_LEGIBILITY_CHECK`

Highest-value frontend questions:

- Is the core mechanism clear in the first ~5 seconds?
- Is progress/waiting truthful within the first ~15 seconds?
- Is there one obvious signature action with a visible consequence?
- Can judges reach the three evidence pairs easily?
- Are negative/neutral outcomes presented honestly?
- Are failure and blocked states distinct?
- Does mobile/keyboard/reduced-motion behavior remain legible?

Do not introduce a fabricated win probability or “Winning Law”.

---

## 12. What remains after this handoff

Backend code: **complete**.  
Observed Agent Advantage: **3 / 3 complete**.  
Health Factor event tape: **complete**.

Remaining project work:

1. Benita frontend V1;
2. Benita backend/frontend public deployment + configuration;
3. public smoke tests;
4. Winner Intelligence + TRACE judge-path review;
5. Project Finisher;
6. merge-to-main authorization;
7. human final submission.

No backend rearchitecture is expected for frontend V1.

---

## 13. Compatibility rule

Allowed while Benita works:

- additive evidence/history records;
- runtime URL/environment changes;
- additive non-breaking fields.

Not allowed without explicit versioning/authority:

- silently changing `spondee.frontend-bootstrap.v1` semantics;
- removing established endpoints;
- promoting SIMULATION to OBSERVED;
- rewriting Grid negative or Rebalancing neutral evidence;
- claiming Health liquidation prevention;
- exposing protected server tokens to browser code;
- converting discovery-only external agents into activatable agents without a verified adapter.

**Benita can start now.**
