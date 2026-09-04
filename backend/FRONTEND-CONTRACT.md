# Spondee Backend → Frontend Contract

Status: `FROZEN_FOR_FRONTEND_V1_OBSERVED_EVIDENCE_3_OF_3`

Source branch: `build/frontend-handoff-ready`

Authoritative backend-completion CI: `33867168666` — PASS.  
Observed-closure preflight: `33868671297` — PASS.  
Deployment contract preflight: `33869418246` — PASS.

Primary source: `GET /v1/product/bootstrap`.

## Local start

```bash
cd backend
npm install
npm run dev
```

For a separately hosted frontend set:

```text
SPONDEE_CORS_ORIGINS=https://frontend.example
```

Multiple origins may be comma-separated. Wildcard CORS is intentionally not the default.

## Bootstrap response

`GET /v1/product/bootstrap`

Top-level fields:

- `schema = spondee.frontend-bootstrap.v1`
- `product`
- `backend_capabilities`
- `categories`
- `agents`
- `demo_tasks`
- `runtime`
- `evidence`
- `endpoints`

Use this response to seed navigation, category cards, agent states, demo task templates, live-write readiness, discovery/replay links and evidence status.

## Catalog + discovery semantics

`agent.activatable=true` means Spondee has a verified activation path for that controlled reference agent.

It does **not** mean a live write is open right now. Before enabling any live action, check:

- `bootstrap.runtime.live_testnet_write_ready`, or
- `GET /v1/runtime/readiness`.

Dynamic external discovery:

`GET /v1/discovery/agents?search=&chain_id=&limit=`

External 8004scan agents are discovery-only and `activatable:false` until an adapter is independently verified. Discovery metadata must not become a performance badge.

## Promise flow

1. Choose a task template from `bootstrap.demo_tasks` or construct a schema-valid task.
2. `POST /v1/promises/preview` with `{ task, agent_id? }`.
3. Render returned `promise` as the Promise Card.
4. Never fabricate `confidence` when it is `null`.

## Activation flow

1. `POST /v1/activations` with `{ promise_id, task, mode }`.
2. `mode` is `SIMULATION` or `LIVE_TESTNET`.
3. A live activation can return `BLOCKED_LIVE_GATE`; this is a truthful state.
4. Actual live write endpoint: `POST /v1/activations/:id/live-testnet`.
5. **Never call the live write endpoint directly from browser code with a server secret.** It requires server-only `SPONDEE_ACTION_TOKEN`. Use a trusted server/BFF or keep judge-facing live writes disabled.
6. During long-running trusted actions, poll `GET /v1/activations/:id` for visible progress.

Possible activation statuses:

- `PREPARED`
- `SIMULATED`
- `BLOCKED_LIVE_GATE`
- `CHAIN_FUNDED`
- `CHAIN_SUBMITTED`
- `COMPLETED`
- `FAILED`

A live action already in `CHAIN_FUNDED`, `CHAIN_SUBMITTED`, `COMPLETED` or `FAILED` is intentionally not auto-retried.

## Decision Replay

Read-only replay:

`GET /v1/activations/:id/replay`

Schema:

`spondee.decision-replay.v1`

Use it to render preserved task inputs, Promise Card, authority/network, job/tx references, Outcome Receipt and timeline. Replay never re-executes a financial action.

## Receipts

Read:

- `GET /v1/receipts`
- `GET /v1/receipts/:id`

G3/G4 category receipts remain:

`evidence_class = SIMULATION`

Live BSC transport does not automatically make a declared scenario observed market evidence.

## Evidence / Agent Advantage

Read:

- `GET /v1/evidence/runs`
- `GET /v1/evidence/runs/:id`
- `GET /v1/evidence/agent-advantage`
- `GET /v1/agents/:id/calibration`

Canonical pre-frontend evidence is now **3/3 countable observed pairs**:

- Grid job `962`: negative result — agent terminal equity `$9,996.660009`, baseline `$9,999.160009`, delta `-$2.50`.
- Health job `971`: warning lead `95.829 s`, response latency `0 ms`, no adverse event observed; no liquidation-prevention claim.
- Rebalancing job `973`: neutral result — agent and baseline both `$10,002.727008`, terminal deviation `1.363132 bps`.

Frontend must present negative and neutral observed outcomes as valid evidence, not as failures and not as hidden results.

Aggregate evidence summary:

`evidence/g5-agent-advantage-3-of-3-final/README.md`

`POST /v1/evidence/baselines` is a **protected server-side ingestion endpoint**, not a normal browser action. It requires `SPONDEE_EVIDENCE_INGEST_TOKEN` and treats existing `run_id` evidence as immutable.

## Health Factor truth boundary

Job `971` closes the hero warning/event-tape requirement under the frozen observed protocol.

Safe presentation:

- measured warning lead: `95.829 s`;
- response latency: `0 ms`;
- adverse event observed in bounded window: `false`.

Do not claim:

- liquidation was prevented;
- safety is guaranteed;
- the same lead time will always recur.

## Production/backend readiness

Read:

`GET /v1/runtime/backend-readiness`

The backend separates code completeness from production configuration. It can report backend code complete while public deployment is blocked by missing database/CORS/protected-token configuration.

The response never returns token values.

## Benita deployment scope

Benita owns public frontend/backend deployment and server configuration.

Existing deployment assets:

- `api/index.mjs`
- `vercel.json`

Required server environment:

- `DATABASE_URL`
- `SPONDEE_CORS_ORIGINS`
- `SPONDEE_ACTION_TOKEN`
- `SPONDEE_EVIDENCE_INGEST_TOKEN`

Optional:

- `SPONDEE_8004SCAN_API_KEY`

`SPONDEE_ACTION_TOKEN` and `SPONDEE_EVIDENCE_INGEST_TOKEN` are server-only and must never enter browser code.

## List APIs

- `GET /v1/promises`
- `GET /v1/activations`
- `GET /v1/receipts`
- `GET /v1/evidence/runs`

These are intended for history/evidence views; do not scrape PBPD/local state files from the browser.

## Hard UI truth boundaries

- SIMULATION != OBSERVED.
- Paper PnL != realized PnL.
- Verified identity != verified performance.
- Verified activation path != currently-open write authority.
- Failure != valid negative or neutral measured outcome.
- Insufficient calibration history != a confidence score.
- External discovery != Spondee activation compatibility.
- Health warning lead != liquidation-prevention guarantee.

## Recommended polling

For an activation detail page, polling every 1–2 seconds during a bounded trusted live action is sufficient for V1. Stop polling on terminal state `COMPLETED` or `FAILED`. Treat `BLOCKED_LIVE_GATE` as terminal until runtime configuration changes.

## Compatibility policy

Frontend V1 may rely on:

- `spondee.frontend-bootstrap.v1`
- Promise Card schema `spondee.promise-card.v1`
- Outcome Receipt schema `spondee.outcome-receipt.v1`
- Decision Replay schema `spondee.decision-replay.v1`
- 8004scan discovery schema `spondee.8004scan-discovery.v1`
- category names/slugs from backend
- activation status enum above

Breaking changes require a versioned contract rather than silent semantic changes.
