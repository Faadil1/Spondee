# Spondee Deployment Runbook

Status: prepared, not executed

## Scope

This runbook prepares a public Spondee deployment without performing deployment, evidence ingestion, live-testnet writes, repository pushes or final submission.

## Required Backend Runtime

Set these on the production backend host only:

- `DATABASE_URL`
- `SPONDEE_CORS_ORIGINS`
- `SPONDEE_ACTION_TOKEN`
- `SPONDEE_EVIDENCE_INGEST_TOKEN`

Optional server-only discovery setting:

- `SPONDEE_8004SCAN_API_KEY`

Never expose action, evidence-ingest, database or wallet credentials to browser code.

## Database Requirements

The backend uses the `pg` package and connects with `new Pool({ connectionString: DATABASE_URL, max: 5 })`.

Required database behavior:

- PostgreSQL-compatible connection string exposed as `DATABASE_URL`.
- JSONB support.
- `TIMESTAMPTZ` support.
- ordinary `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` permissions on startup.
- durable storage for Promise Cards, activations, Outcome Receipts, evidence runs and operation locks.

Startup initialization is idempotent. When `DATABASE_URL` is present, the PostgreSQL store runs the backend DDL automatically during `createStore().init()`. The same deployable DDL is mirrored in `backend/sql/001_init.sql`.

Tables created:

- `spondee_promises`
- `spondee_activations`
- `spondee_receipts`
- `spondee_evidence_runs`
- `spondee_operation_locks`

Indexes created:

- `idx_spondee_promises_category`
- `idx_spondee_activations_status`
- `idx_spondee_evidence_class`
- `idx_spondee_operation_locks_expiry`

If `DATABASE_URL` is absent, the backend falls back to an in-memory store for local development/CI. That is not production-ready and loses runtime state across process restarts.

For Vercel production, use a managed Postgres provider that supports normal Node.js `pg` connections from Vercel Functions. Neon Postgres through Vercel Marketplace is the simplest compatible choice for this hackathon because it provisions a serverless Postgres resource and injects credentials into the linked Vercel project. Supabase Postgres or another Vercel-compatible Postgres can also work if the `DATABASE_URL` is a valid `pg` connection string and SSL/network access are configured correctly.

Keep the database region close to the backend function region when choosing provider settings.

## Environment Contract

| Variable | Where | Required? | Browser-safe? | Purpose |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Backend only | Required for production | No | Selects PostgreSQL store and durable runtime state |
| `SPONDEE_CORS_ORIGINS` | Backend only | Required for production | No secret, but server config only | Comma-separated allowlist of exact frontend origins |
| `SPONDEE_ACTION_TOKEN` | Backend only | Required for production readiness | No | Protects the live-testnet action endpoint |
| `SPONDEE_EVIDENCE_INGEST_TOKEN` | Backend only | Required for production readiness | No | Protects immutable evidence ingestion |
| `SPONDEE_8004SCAN_API_KEY` | Backend only | Optional | No | Optional authenticated 8004scan discovery reads |
| `SPONDEE_8004SCAN_API_BASE_URL` | Backend only | Optional | No secret | Defaults to the official 8004scan API base |
| `SPONDEE_8004SCAN_CACHE_SECONDS` | Backend only | Optional | No secret | Discovery cache duration |
| `SPONDEE_LIVE_TESTNET_ENABLED` | Backend only | Optional; keep false unless explicitly authorized | No secret | Opens the live write gate only when all other live settings exist |
| `SPONDEE_SELLER_A2A_URL` | Backend only | Required only for live writes | No secret, but server config only | Seller A2A endpoint for protected live execution |
| `BUYER_WALLET_ADDRESS` | Backend only | Required only for live writes | No secret, but server config only | Throwaway BSC-testnet buyer address |
| `BUYER_WALLETS_DIR` | Backend only | Required only for live writes | No | Local encrypted keystore path |
| `BUYER_WALLET_PASSWORD` | Backend only | Required only for live writes | No | Keystore password |
| `NEXT_PUBLIC_SPONDEE_BACKEND_URL` | Frontend only | Required for production frontend | Yes | Public HTTPS origin of the deployed backend |

The only value intentionally exposed to browser code is `NEXT_PUBLIC_SPONDEE_BACKEND_URL`.

## CORS Contract

`SPONDEE_CORS_ORIGINS` is a comma-separated list of exact origins:

```text
SPONDEE_CORS_ORIGINS=https://spondee.example.com,https://spondee-preview.example.com
```

Rules:

- Include scheme and host.
- Include port only when the public origin actually has one.
- Do not include path segments.
- Do not use `*`.
- Local defaults are allowed only when `SPONDEE_CORS_ORIGINS` is absent: `http://localhost:3000`, `http://localhost:5173`, `http://127.0.0.1:3000`, `http://127.0.0.1:5173`.
- Production readiness treats an absent `SPONDEE_CORS_ORIGINS` as a blocker even though local defaults exist.
- CORS preflight from a disallowed origin returns `403`.
- Non-OPTIONS requests from disallowed origins continue without `Access-Control-Allow-Origin`, so browsers block the response.

## Deployment Topology

Use two Vercel projects:

1. Backend project rooted at the repository root, using `api/index.mjs` and root `vercel.json`.
2. Frontend project rooted at `frontend/`, using the Next.js app directly.

This keeps server-only backend secrets out of the frontend project and matches the current repository without rearchitecting into a template monorepo. A single combined Vercel project would simplify the public URL shape, but it would mix frontend and protected backend env scope and does not match the current `frontend/` app plus root backend wrapper layout.

The root backend build command installs and builds the backend:

```bash
npm --prefix backend install --no-audit --no-fund && npm --prefix backend run build
```

The frontend build runs from `frontend/`:

```bash
npm run build
```

## Backend Deployment Execution Prep

This section is for human execution only. Do not run these steps from an automated agent without explicit deployment approval.

No `.vercel` project link metadata is currently committed for either the repo root or `frontend/`. Link each Vercel project deliberately from the correct directory before deploying.

Recommended local CLI prep:

```bash
npm i -g vercel@latest
vercel --version
vercel login
vercel whoami
```

Safe token generation commands for the human to run locally:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Use the first generated value as `SPONDEE_ACTION_TOKEN` and the second as `SPONDEE_EVIDENCE_INGEST_TOKEN`. Do not paste those values into source files, chat, screenshots or browser bundles.

Backend human checklist:

1. Create a Neon Postgres database, preferably through Vercel Marketplace so the Vercel project can receive managed environment variables.
2. Obtain the production PostgreSQL connection string as `DATABASE_URL`.
3. From the repository root, link or create the backend Vercel project:

   ```bash
   vercel link
   ```

4. Confirm the linked project is the backend project, not the frontend project:

   ```bash
   vercel project ls
   vercel whoami
   ```

5. Add backend production environment variables from the repo root:

   ```bash
   vercel env add DATABASE_URL production
   vercel env add SPONDEE_ACTION_TOKEN production
   vercel env add SPONDEE_EVIDENCE_INGEST_TOKEN production
   vercel env add SPONDEE_CORS_ORIGINS production
   ```

6. If the final frontend URL is not known yet, set `SPONDEE_CORS_ORIGINS` to a temporary exact holding origin that you control, such as the expected frontend production domain or a single known Vercel preview origin after it exists. Do not use wildcard CORS.
7. Optionally add `SPONDEE_8004SCAN_API_KEY` only if authenticated 8004scan reads are needed:

   ```bash
   vercel env add SPONDEE_8004SCAN_API_KEY production
   ```

8. Keep live-testnet write variables unset or disabled unless a later explicit authorization opens the live gate.
9. Deploy the backend from the repository root:

   ```bash
   vercel deploy --prod
   ```

10. Save the backend production URL returned by Vercel.
11. Inspect deployment details if needed:

    ```bash
    vercel inspect <backend-production-url>
    ```

12. Verify health:

    ```bash
    curl -fsS https://<backend-production-host>/healthz
    ```

13. Verify backend configuration readiness:

    ```bash
    curl -fsS https://<backend-production-host>/v1/runtime/backend-readiness
    ```

14. Verify runtime readiness:

    ```bash
    curl -fsS https://<backend-production-host>/v1/runtime/readiness
    ```

15. Verify PostgreSQL schema initialization with one of these non-canonical-evidence checks:

    ```sql
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'spondee_%'
    ORDER BY table_name;
    ```

    Expected tables: `spondee_activations`, `spondee_evidence_runs`, `spondee_operation_locks`, `spondee_promises`, `spondee_receipts`.

16. Confirm runtime evidence is still expected to be empty before evidence ingestion:

    ```bash
    curl -fsS https://<backend-production-host>/v1/evidence/agent-advantage
    ```

    Before canonical evidence initialization, expected status is `INSUFFICIENT_OBSERVED_EVIDENCE` and `paired_run_count` may be `0`.

17. After the frontend production URL is known, update backend `SPONDEE_CORS_ORIGINS` to the exact frontend origin and redeploy or redeploy/promote as needed.

Frontend wiring after backend is verified:

1. From `frontend/`, link or create the separate frontend Vercel project:

   ```bash
   cd frontend
   vercel link
   ```

2. Add only the public backend origin:

   ```bash
   vercel env add NEXT_PUBLIC_SPONDEE_BACKEND_URL production
   ```

3. Use this value format:

   ```text
   NEXT_PUBLIC_SPONDEE_BACKEND_URL=https://<backend-production-host>
   ```

4. Do not add `DATABASE_URL`, `SPONDEE_ACTION_TOKEN`, `SPONDEE_EVIDENCE_INGEST_TOKEN`, wallet settings or buyer passwords to the frontend project.

Database verification options:

- Preferred: inspect the Neon/Vercel database console or SQL editor for the `spondee_%` tables after the first backend request.
- Readiness: `GET /v1/runtime/backend-readiness` should report `durable_persistence_configured: true`.
- Persistence smoke, only if acceptable: create a normal browser-safe `SIMULATION` activation through the frontend/backend, then verify the activation survives a backend redeploy or cold start. This creates demo runtime records but does not create observed evidence and does not call protected endpoints.

Failure plan:

| Failure | Response |
| --- | --- |
| Backend build fails on Vercel | Inspect build logs with `vercel inspect <url> --logs`; confirm root project uses root `vercel.json`, build command runs `npm --prefix backend install --no-audit --no-fund && npm --prefix backend run build`, and Node satisfies `backend/package.json` `>=22`. |
| `DATABASE_URL` is invalid | Replace the backend production env value with the provider connection string; redeploy; verify `backend-readiness` and table creation again. |
| Schema init fails | Confirm the DB user can create tables/indexes in the target schema; compare with `backend/sql/001_init.sql`; fix DB permissions or connection target, then redeploy. |
| CORS blocks frontend | Set `SPONDEE_CORS_ORIGINS` to the exact frontend origin, including scheme and host only; do not use `*`; redeploy backend if Vercel requires it for env changes. |
| Backend readiness reports missing config | Add the named missing production env var to the backend project, then redeploy/check again. |
| BSC read probe fails | Treat `/v1/runtime/readiness` as degraded, not necessarily deployment-failed; check `/healthz` and `/v1/runtime/backend-readiness` separately. Retry later or inspect RPC/network status. |
| Runtime evidence remains `0/3` | Expected until exact canonical bundles are recovered and ingested through `POST /v1/evidence/baselines`; do not reconstruct evidence from README prose. |

## Readiness Endpoints

`GET /healthz`

- proves the backend process/function can load and respond;
- does not prove durable PostgreSQL, CORS, token readiness, evidence readiness or public frontend wiring.

`GET /v1/runtime/backend-readiness`

- proves production configuration presence for `DATABASE_URL`, `SPONDEE_CORS_ORIGINS`, `SPONDEE_ACTION_TOKEN` and `SPONDEE_EVIDENCE_INGEST_TOKEN`;
- returns `200` only when those required settings are configured;
- returns `503` with blocker names when any required setting is missing;
- never prints secret values;
- does not prove canonical evidence has been ingested.

`GET /v1/runtime/readiness`

- includes backend readiness;
- includes live gate state;
- performs a public BSC-testnet read probe;
- does not perform live writes;
- may return `503` if the public chain read probe fails.

Production checklist:

| Gate | Meaning | Required before public demo? |
| --- | --- | --- |
| CODE READY | Backend and frontend builds/tests pass | Yes |
| DB READY | `DATABASE_URL` points to durable Postgres and DDL initializes | Yes |
| CORS READY | Backend allowlist includes final frontend origin | Yes |
| PROTECTED TOKENS READY | Server-only action and evidence tokens configured | Yes |
| LIVE TESTNET READY | Live write gate and wallet/seller settings configured | Optional; keep disabled unless explicitly authorized |
| EVIDENCE READY | Exact canonical evidence payloads ingested into runtime DB | Blocked until recovered bundles exist |
| PUBLIC READY | Frontend and backend deployed, wired and smoke-tested | Yes |

## Expected Readiness Order

1. Create a managed PostgreSQL database, preferably Neon through Vercel Marketplace for the shortest compatible setup.
2. Obtain the production `DATABASE_URL`.
3. Configure backend env: `DATABASE_URL`, `SPONDEE_CORS_ORIGINS`, `SPONDEE_ACTION_TOKEN`, `SPONDEE_EVIDENCE_INGEST_TOKEN`.
4. Configure optional backend env only if needed: `SPONDEE_8004SCAN_API_KEY`, custom 8004scan base/cache settings.
5. Keep live-testnet write env disabled unless a later explicit authorization opens that gate.
6. Deploy the backend project from the repository root.
7. Verify backend `GET /healthz`.
8. Verify backend `GET /v1/runtime/backend-readiness` returns `public_deployment_ready: true`.
9. Configure frontend env: `NEXT_PUBLIC_SPONDEE_BACKEND_URL=https://<production-backend-origin>`.
10. Update backend `SPONDEE_CORS_ORIGINS` to include the exact production frontend origin after it is known.
11. Deploy the frontend project from `frontend/`.
12. Run public read-only smoke tests.
13. Later, initialize canonical evidence only after exact Grid 962, Health 971 and Rebalancing 973 machine-readable bundles are recovered and approved.
14. Verify runtime Agent Advantage with `GET /v1/evidence/agent-advantage` and `GET /v1/product/bootstrap`.
15. Run an explicit local-only simulation smoke only when it is acceptable to create demo runtime records.

## Evidence Initialization Boundary

`GET /v1/product/bootstrap` and `GET /v1/evidence/agent-advantage` calculate Agent Advantage from runtime store records. Repository evidence summaries do not load themselves into runtime state.

The existing supported ingestion mechanism is:

`POST /v1/evidence/baselines`

That endpoint is protected by `SPONDEE_EVIDENCE_INGEST_TOKEN`, validates the `EvidenceRunInputSchema`, and treats existing `run_id` values as immutable:

- identical retry returns idempotent success;
- changed content for the same `run_id` is rejected;
- new evidence records are inserted once.

The current repository contains canonical README summaries for jobs 962, 971 and 973, but the checked evidence directories do not contain ready-to-post JSON payload files. Do not synthesize ingestion payloads from prose. Archive or locate the sanitized raw bundles first, then transform only validated raw records into schema-compatible payloads.

## Safe Production Checks

Run read-only smoke:

```bash
node scripts/smoke-public.mjs --frontend https://frontend.example --backend https://backend.example
```

Optional local-only simulation smoke:

```bash
node scripts/smoke-public.mjs --frontend http://localhost:3000 --backend http://localhost:8787 --local-mutating-simulation
```

The optional simulation path calls browser-safe endpoints only:

- `POST /v1/promises/preview`
- `POST /v1/activations` with `SIMULATION`

It must not be used as observed evidence and must not be run against production unless the owner explicitly accepts creating demo runtime records.

## Public Smoke Expectations

- frontend pages return HTTP 200;
- backend `healthz` returns `ok: true`;
- bootstrap schema is `spondee.frontend-bootstrap.v1`;
- all four categories are present;
- evidence APIs distinguish runtime state from preserved repository evidence;
- protected mutation endpoints are not called;
- no token values are printed.
