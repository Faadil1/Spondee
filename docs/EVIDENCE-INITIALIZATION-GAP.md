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

## Required Ingestion Payload Shape

Production evidence initialization must post individual `EvidenceRunInputSchema` records to `POST /v1/evidence/baselines`.

Required fields:

- `run_id`
- `category`
- `scenario_id`
- `agent_id`
- `version`
- `evidence_class`
- `promise_timestamp`
- `expected_outcome`
- `confidence`
- `expected_downside`
- `expected_cost`
- `actual_outcome`
- `actual_cost`

Optional/defaulted fields that must be preserved when present:

- `warning_timestamp`
- `action_timestamp`
- `event_timestamp`
- `tx_hashes`
- `output_artifacts`
- `baseline_type`
- `baseline_run_id`
- `advantage_delta`
- `calibration_error`
- `notes`

For each observed pair, the runner-generated `pair-bundle.json` is the expected structured source. It contains both:

- `agent_run`: the observed agent `EvidenceRunInputSchema` payload; and
- `baseline_run`: the matching observed baseline `EvidenceRunInputSchema` payload.

The agent run must reference the baseline run by `baseline_run_id`, and the baseline run must not itself reference another baseline.

## Pair-by-Pair Readiness

| Pair | Agent payload available? | Baseline payload available? | Source file | Validated? | Missing fields/data |
| --- | --- | --- | --- | --- | --- |
| Grid Trading job `962` | No tracked payload found | No tracked payload found | Expected `pair-bundle.json` from `backend/src/live-g5-grid-forward.ts`; checked repo currently has `evidence/g5-grid-forward-job-962-countable-pass/README.md` only | No | Full `agent_run`, full `baseline_run`, artifact URIs/hashes, exact generated timestamps and structured output fields |
| Health Factor job `971` | No tracked payload found | No tracked payload found | Expected `evidence/g5-health-forward-job-971-countable-pass/raw-bundle/pair-bundle.json` after archive; current README points to `C:\Users\fboussari\AppData\Local\Temp\spondee-g5-health-forward-20260904-093446` | No | Full `agent_run`, full `baseline_run`, artifact URIs/hashes, exact event/timing fields and structured output fields |
| Rebalancing job `973` | No tracked payload found | No tracked payload found | Expected `evidence/g5-rebalancing-forward-job-973-countable-pass/raw-bundle/pair-bundle.json` after archive; current README points to `C:\Users\fboussari\AppData\Local\Temp\spondee-g5-rebalancing-forward-20260904-093446` | No | Full `agent_run`, full `baseline_run`, artifact URIs/hashes, exact timing/cost fields and structured output fields |

README prose, ledger summaries, and project-state YAML are not sufficient for runtime initialization because they do not preserve every immutable field of the schema-compatible payloads.

## Archive Script Behavior

`scripts/archive-g5-pre-frontend-evidence.ps1` expects:

- Health source: `$env:LOCALAPPDATA\Temp\spondee-g5-health-forward-20260904-093446`
- Rebalancing source: `$env:LOCALAPPDATA\Temp\spondee-g5-rebalancing-forward-20260904-093446`

It copies each source directory recursively into:

- `evidence/g5-health-forward-job-971-countable-pass/raw-bundle`
- `evidence/g5-rebalancing-forward-job-973-countable-pass/raw-bundle`

It refuses to overwrite existing destination directories, scans `.json`, `.txt`, `.md`, `.log`, `.yaml` and `.yml` files for common sensitive-material markers, and writes:

- `evidence/g5-agent-advantage-3-of-3-final/raw-archive-manifest.json`

If Faadil's Windows temp directories still contain the runner outputs, the archive should recover the Health and Rebalancing `pair-bundle.json` files and supporting raw artifacts. It does not currently recover Grid job `962`; locate the original Grid runner output directory containing its generated `pair-bundle.json` before attempting production initialization.

## Human Recovery Steps

Ask Faadil to run the archive from the repository root on the Windows machine that produced jobs `971` and `973`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\archive-g5-pre-frontend-evidence.ps1
```

Then verify before committing or sending artifacts:

```powershell
Test-Path .\evidence\g5-health-forward-job-971-countable-pass\raw-bundle\pair-bundle.json
Test-Path .\evidence\g5-rebalancing-forward-job-973-countable-pass\raw-bundle\pair-bundle.json
Test-Path .\evidence\g5-agent-advantage-3-of-3-final\raw-archive-manifest.json
Select-String -Path .\evidence\g5-health-forward-job-971-countable-pass\raw-bundle\* -Pattern '(?i)(private[_ -]?key|seed phrase|mnemonic|wallet password|keystore password)' -Recurse
Select-String -Path .\evidence\g5-rebalancing-forward-job-973-countable-pass\raw-bundle\* -Pattern '(?i)(private[_ -]?key|seed phrase|mnemonic|wallet password|keystore password)' -Recurse
```

Do not commit secrets, wallet files, private keys, seed phrases, keystore passwords, or unsanitized local machine state. Commit or send only the sanitized raw evidence bundle needed to validate and extract the exact `agent_run` and `baseline_run` payloads.

Before writing an initializer, also locate the Grid job `962` runner output directory containing its validated `pair-bundle.json` and supporting raw artifacts. Do not reconstruct that payload from the README summary.

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
