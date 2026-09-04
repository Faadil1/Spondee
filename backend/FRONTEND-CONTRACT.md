# Spondee Backend → Frontend Contract

Status: `FROZEN_FOR_FRONTEND_V1_AFTER_BACKEND_COMPLETION`

Source branch: `build/backend-completion-final`

Authoritative backend-completion CI: `33866229883` — PASS.

Primary source: `GET /v1/product/bootstrap`.

## Local start

```bash
cd backend
npm install
npm run dev
```

Default local API: whatever `PORT` is configured by `src/server.ts`.

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

Use this response to seed navigation, category cards, agent states, demo task templates, live-write readiness, discovery links, replay links and evidence status.

## Catalog + discovery semantics

`agent.activatable=true` means Spondee has a **verified activation path** for that controlled reference agent.

It does **not** mean a live write is open right now. Before enabling any live action, check:

- `bootstrap.runtime.live_testnet_write_ready`, or
- `GET /v1/runtime/readiness`.

`agent.activation_proof.status=VERIFIED_LIVE_TESTNET` is safe to display as a verification badge.

Dynamic external discovery is available via:

`GET /v1/discovery/agents?search=&chain_id=&limit=`

External 8004scan agents returned by discovery are always discovery-only and `activatable: false` until an adapter is independently verified. Do not transform discovery metadata into a performance badge.

## Promise flow

1. Choose a task template from `bootstrap.demo_tasks` or construct a schema-valid task.
2. `POST /v1/promises/preview` with `{ task, agent_id? }`.
3. Render returned `promise` as the Promise Card.
4. Never fabricate `confidence` when it is `null`.

## Activation flow

1. `POST /v1/activations` with `{ promise_id, task, mode }`.
2. `mode` is `SIMULATION` or `LIVE_TESTNET`.
3. A live activation can be returned as `BLOCKED_LIVE_GATE`; this is a valid truthful state.
4. The actual live write endpoint is `POST /v1/activations/:id/live-testnet`.
5. **Do not call the live write endpoint directly from a browser with a server secret.** It requires the server-only `SPONDEE_ACTION_TOKEN`. A public frontend should either keep live writes disabled for judges or use a trusted server/BFF route with its own user/session authorization.
6. During long-running live work, poll `GET /v1/activations/:id` to render progress/status while the trusted action request remains pending.

Possible activation statuses:

- `PREPARED`
- `SIMULATED`
- `BLOCKED_LIVE_GATE`
- `CHAIN_FUNDED`
- `CHAIN_SUBMITTED`
- `COMPLETED`
- `FAILED`

A backend live action already in `CHAIN_FUNDED`, `CHAIN_SUBMITTED`, `COMPLETED` or `FAILED` is intentionally not auto-retried.

## Decision Replay

Read-only replay:

`GET /v1/activations/:id/replay`

Schema:

`spondee.decision-replay.v1`

Use it to render:

- preserved task inputs;
- Promise Card;
- activation authority/network;
- job/transaction references;
- Outcome Receipt;
- update/failure timeline.

Replay never re-executes a financial action.

## Receipts

Read:

- `GET /v1/receipts`
- `GET /v1/receipts/:id`

Receipt truth rule for current G3/G4 category receipts:

`evidence_class = SIMULATION`

Live BSC transport does not automatically make a declared scenario observed market evidence.

## Evidence / Agent Advantage

Read:

- `GET /v1/evidence/runs`
- `GET /v1/evidence/runs/:id`
- `GET /v1/evidence/agent-advantage`
- `GET /v1/agents/:id/calibration`

The first countable observed pair is Grid job 962. Current product status is 1/3 required pairs. Frontend must support the count changing without architecture changes.

Negative deltas are valid evidence and must not be visually converted into success.

`POST /v1/evidence/baselines` is a **protected server-side ingestion endpoint**, not a normal browser action. It requires `SPONDEE_EVIDENCE_INGEST_TOKEN` and treats existing `run_id` evidence as immutable.

## Production/backend readiness

Read:

`GET /v1/runtime/backend-readiness`

The backend separates code completeness from production configuration. The endpoint can return backend code complete while public deployment is still blocked by missing environment configuration such as durable database/CORS/protected tokens.

The response never returns token values.

## List APIs

- `GET /v1/promises`
- `GET /v1/activations`
- `GET /v1/receipts`
- `GET /v1/evidence/runs`

These are intended for history/evidence views and frontend integration; do not scrape PBPD/local state files from the browser.

## Hard UI truth boundaries

- SIMULATION != OBSERVED.
- Paper PnL != realized PnL.
- Verified identity != verified performance.
- Verified activation path != currently-open write authority.
- Failure != valid negative outcome.
- Insufficient calibration history != a confidence score.
- External discovery != Spondee activation compatibility.

## Recommended polling

For an activation detail page, polling every 1–2 seconds during a bounded live action is sufficient for V1. Stop polling on terminal state `COMPLETED` or `FAILED`. Treat `BLOCKED_LIVE_GATE` as terminal until runtime configuration changes.

## Compatibility policy

Frontend V1 may rely on:

- `spondee.frontend-bootstrap.v1`
- Promise Card schema `spondee.promise-card.v1`
- Outcome Receipt schema `spondee.outcome-receipt.v1`
- Decision Replay schema `spondee.decision-replay.v1`
- 8004scan discovery schema `spondee.8004scan-discovery.v1`
- category names/slugs from backend
- activation status enum above

Future evidence work should update data values and add evidence records without breaking this V1 contract. Breaking changes require a versioned contract rather than silent field-semantic changes.
