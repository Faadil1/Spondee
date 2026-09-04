# Spondee G4 — Three Reference Agents Build/CI PASS

Date: 2026-09-04 UTC
Gate: `SPONDEE_G4_THREE_REFERENCE_AGENTS_BUILD_AND_CI_REQUIRED`

## Result

`PASS`

Three distinct Spondee Agent Studio reference-agent workspaces now exist for the remaining required categories:

- `reference-agents/grid` -> `spondee-grid-agent`
- `reference-agents/rebalancing` -> `spondee-rebalancing-agent`
- `reference-agents/yield` -> `spondee-yield-agent`

They reuse the transport/runtime pattern proven by Health Factor G3 while locking category-specific task schemas and deterministic Promise/Outcome Receipt behavior.

## Authoritative CI

Workflow: `G4 Three Reference Agents CI`
Run: `33826331454`
Head: `c537f2a7c70012c8712e91257a17390549885cda`
Result: `completed / success`

For Grid, Rebalancing and Yield independently:

- pinned Agent Studio CLI `0.0.13` install: PASS
- frozen pnpm workspace install: PASS
- native `bag scan` + credential-free diagnostics: PASS
- category contract tests: PASS
- strict TypeScript build: PASS
- deterministic Promise/Outcome Receipt export: PASS
- zero-price/BSC-testnet/simulation safety checks: PASS
- evidence artifact upload: PASS

Windows Node 24 static/config validation also passed.

## Evidence artifacts

### Grid

- artifact id: `9920092070`
- name: `spondee-g4-grid-evidence`
- digest: `sha256:e351304d2c0962f017ef766900708b405d2617ada60825e9ddfad8039010d378`

### Rebalancing

- artifact id: `9920091773`
- name: `spondee-g4-rebalancing-evidence`
- digest: `sha256:070f307d5bcb22100194d907ca49485f8aa249da230d7e11f1401c9b486d239c`

### Yield

- artifact id: `9920093946`
- name: `spondee-g4-yield-evidence`
- digest: `sha256:570a6657ab4d744e9cd50e7dfd6823c346b12b544f4edb1d034d76d755af51cd`

## Contract behavior proven in CI

Each workspace:

1. accepts only its own Spondee task schema;
2. rejects a wrong-category task;
3. Base64URL-encodes the signed task using `SPONDEE_TASK_B64_V1`;
4. creates a zero-price `spondee.promise-card.v1`;
5. carries exactly one compact `SPONDEE_PROMISE_COMMITMENT_V1` commitment;
6. reconstructs the Promise deterministically during work execution;
7. emits `spondee.outcome-receipt.v1` with `evidence_class=SIMULATION`;
8. keeps `eligible_for_observed_agent_advantage=false`;
9. rejects a tampered Promise commitment;
10. remains configured for BSC testnet with automatic paid surfaces disabled.

## Architecture note

The workspaces intentionally preserve the proven Health Factor seller transport, including the internal compatibility skill id `preview_health_factor`. The Agent Cards and task schemas are category-aware. Refactoring that wire id is not required for correctness and is deferred until after live-path proof to avoid introducing compatibility churn.

## What this does NOT prove

- no Grid/Rebalancing/Yield agent has been deployed yet;
- no new ERC-8183 live job has been created;
- no seller wallet was unlocked;
- no tBNB or user capital was used;
- no observed Agent Advantage evidence exists from these simulation receipts;
- public judge availability is still pending.

## Preflight discovery after CI

A subsequent read-only review found that the original backend live buyer function still rejected non-Health-Factor task schemas. That guard was not a seller-agent failure; it was a shared buyer-driver compatibility blocker.

A separate multi-category driver was therefore added in `backend/src/category-erc8183.ts` and tested in `backend/src/category-erc8183.test.ts`. It reuses the G3 signature/commitment/zero-price checks and improves post-submit resolution by decoding `JobInitialised` from the bounded known submit transaction receipt rather than a historical log scan.

Backend CI run `33826671823` passed tests, TypeScript, four-category smoke, claim-boundary checks and the read-only BSC/contract probe on commit `3698e9ecfda0a71145333fb0ad2f5f789270aee1`.

## Gate conclusion

`SPONDEE_G4_THREE_REFERENCE_AGENTS_BUILD_AND_CI = PASS`

The codebase is ready for a credential-free live-testnet preflight and then a separately authorized, sequential live E2E proof for Grid, Rebalancing and Yield. No live writes are authorized by this evidence record itself.
