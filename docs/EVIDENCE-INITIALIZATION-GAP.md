# Evidence Initialization Gap

Status: open production-prep item

## Finding

Canonical Agent Advantage evidence is documented as 3/3 in repository summaries:

- Grid Trading job 962
- Health Factor Monitoring job 971
- Rebalancing job 973

The runtime API does not read those README files. It reads evidence records from the configured `SpondeeStore`.

## Current Repository State

The checked evidence directories for jobs 962, 971 and 973 currently contain README summaries only. The Health Factor and Rebalancing summaries point to raw bundles that were originally produced under a Windows temp directory and instruct maintainers to run `scripts/archive-g5-pre-frontend-evidence.ps1` before temp cleanup.

Because the ready-to-post JSON evidence payloads are not present in the repository, this prep phase does not create an ingestion script with embedded payloads.

## Existing Supported Mechanism

Use the existing protected endpoint after locating or archiving sanitized raw bundles:

`POST /v1/evidence/baselines`

This route requires `SPONDEE_EVIDENCE_INGEST_TOKEN`, validates the backend evidence schema, and rejects mutation of an existing `run_id` unless the retry payload is byte-equivalent JSON content.

## Required Before Public Deployment

1. Confirm the production backend uses a dedicated PostgreSQL database.
2. Confirm `GET /v1/runtime/backend-readiness` is production-ready without revealing secrets.
3. Locate or archive sanitized raw evidence bundles for 962, 971 and 973.
4. Convert raw records into `EvidenceRunInputSchema` payloads without altering measured results.
5. Ingest through `POST /v1/evidence/baselines` with the server-only evidence token.
6. Re-check `GET /v1/evidence/agent-advantage` and `GET /v1/product/bootstrap`.

Fresh PostgreSQL deployments should be expected to report 0/3 until this initialization occurs.
