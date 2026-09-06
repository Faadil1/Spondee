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

## Expected Readiness Order

1. Provision a dedicated PostgreSQL database.
2. Configure backend environment variables.
3. Start the backend and confirm `GET /healthz`.
4. Confirm `GET /v1/runtime/backend-readiness` returns `public_deployment_ready: true`.
5. Initialize canonical evidence only after human approval and only through the protected immutable ingestion path.
6. Configure frontend `NEXT_PUBLIC_SPONDEE_BACKEND_URL` to the approved backend origin.
7. Deploy frontend.
8. Run public read-only smoke tests.
9. Run an explicit local-only simulation smoke only when it is acceptable to create demo runtime records.

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
