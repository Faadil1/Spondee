# G3 funded job 948 recovery — READY

Date: 2026-09-03

## Fourth bounded live attempt

The compact-commitment MegaFuel attempt advanced materially beyond all previous runs.

On BSC Testnet job **948** was created, registered, budgeted at zero and funded at zero. The following transactions were reported by the human local runtime:

- `CREATE_JOB`: `0x6630ebe43233fa2cf19e843d24933c656bd885c7f7a756593b0f23e9c765c2f3`
- `REGISTER_JOB`: `0x5205db611ce4f8008f1af78b51f9bbd166b701f8dbe076f70354fce814002a58`
- `SET_BUDGET`: `0x1ad306e022385ee3b25777f81042e98469867ee586abf6d445ea5febeb8b618b`
- `FUND`: `0x279bf5c9017393450ff1aa7628c3da8f673754c8931c1de5f76942961a7c618e`

The provider then generated `.agent-data/erc8183-job-948.json`, but `submitWorkflow` refused to publish it because LocalStorage returned a `file://` URL while `ERC8183_AGENT_URL` was unset. No provider submit transaction landed in that attempt.

Classification: **LIVE_CHAIN_PARTIAL_SUCCESS__DELIVERABLE_URL_CONFIGURATION_BLOCKER**.

This proves the compact Promise commitment, sanitizer-safe task carrier, MegaFuel `createJob`, `registerJob`, `setBudget(0)` and `fund(0)` path in the complete Spondee flow. It does **not** yet prove provider submit, on-chain deliverable URL, verified manifest, or verified Outcome Receipt.

## Official SDK contract

BNB Agent SDK documents that LocalStorageProvider returns `file://` URLs and requires `ERC8183_AGENT_URL`; the SDK then rewrites the deliverable URL to `{ERC8183_AGENT_URL}/job/{id}/response`.

## Recovery design

Do not create another job. Recover the already-FUNDED job 948.

New recovery artifacts:

- `scripts/local-erc8183-deliverable-server.mjs`
  - local/testnet-only HTTP server;
  - serves `.agent-data/erc8183-job-{id}.json` at `/erc8183/job/{id}/response`;
  - no wallet or secret access.
- `backend/src/resume-g3-funded.ts`
  - accepts only an explicit existing job id;
  - verifies canonical provider, structured Spondee task, zero-price Promise commitment and canonical Health Factor task;
  - sends `notify_funded` only if the job is still FUNDED;
  - performs no `createJob`, `registerJob`, `setBudget`, or `fund`;
  - waits for SUBMITTED/COMPLETED;
  - fetches the on-chain deliverable URL;
  - verifies `DeliverableManifest` against the on-chain deliverable hash;
  - verifies the Spondee Outcome Receipt and SIMULATION claim boundary.
- `scripts/g3-resume-funded-job.ps1`
  - canonically bound to job 948;
  - reuses the existing encrypted seller wallet;
  - starts the local deliverable server first;
  - sets `ERC8183_AGENT_URL=http://127.0.0.1:9100/erc8183` in the seller child environment;
  - resumes job 948 without another buyer activation.
- `.github/workflows/g3-funded-recovery-ci.yml`
  - deterministic no-secret/no-write validation.

## CI

GitHub Actions run **33819012423**: PASS.

Verified:

- recovery PowerShell parses on Ubuntu;
- local deliverable server syntax passes;
- `/erc8183/job/948/response` serves an actual manifest fixture;
- missing manifest fails closed;
- backend tests pass;
- strict backend TypeScript build including `resume-g3-funded.ts` passes;
- recovery PowerShell parses on Windows;
- local deliverable server syntax passes on Windows Node 24.

## Authority and next gate

Existing human authorization covers bounded BSC-testnet execution and seller signing. This recovery introduces no new buyer funding or new job creation. Exactly one recovery execution of job 948 is authorized after pulling the CI-verified branch.

Still forbidden:

- new blind live activation if recovery fails;
- mainnet activity;
- meaningful user capital;
- new seller wallet;
- secret disclosure;
- merge to main;
- public deployment;
- final hackathon submission.

Next exact gate:

`SPONDEE_G3_FUNDED_JOB_948_DELIVERABLE_RECOVERY_LOCAL_EXECUTION_REQUIRED`
