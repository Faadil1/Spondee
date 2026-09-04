# Spondee G4 — Sequential Live Testnet Preflight PASS

Date: 2026-09-04 UTC
Gate: `SPONDEE_G4_THREE_CATEGORY_SEQUENTIAL_LIVE_TESTNET_E2E_REQUIRED`
Preflight conclusion: **PASS**

## Authoritative verification

- GitHub Actions workflow: `G4 Sequential Live Preflight`
- Run ID: `33827625957`
- Validated head: `01050a567bbd4a670a0663702c5a581e8c9dbe96`
- Status: `completed`
- Conclusion: `success`

## What passed

All five jobs completed successfully:

1. backend preflight
   - backend dependency installation
   - all 31 unit/API/runtime-guard tests
   - strict TypeScript build including `live-g4-category.ts`
   - Grid/Rebalancing/Yield bounded live scenario schema validation
   - explicit proof that the live driver remains closed when local credentials/runtime gate are absent
2. Grid Agent Studio path
   - frozen dependency install
   - contract tests
   - strict TypeScript build
   - deterministic evidence export
3. Rebalancing Agent Studio path
   - frozen dependency install
   - contract tests
   - strict TypeScript build
   - deterministic evidence export
4. Yield Agent Studio path
   - frozen dependency install
   - contract tests
   - strict TypeScript build
   - deterministic evidence export
5. Windows runner parse/safety
   - PowerShell parse PASS
   - no seller `wallet:create`
   - no `bsc-mainnet`
   - stop-on-first-failure guard present
   - dedicated gate branch guard present

## Earlier preflight failures

Runs `33827404892` and `33827511988` failed only on deterministic preflight tooling issues before any live execution:

- PowerShell variable delimiter syntax in the wrapper;
- top-level `await` in a `tsx -e` CI probe.

Both were corrected and the authoritative run above is green. No G4 chain transaction was attempted in any preflight run.

## Live gate now opened

The next executable gate is:

`SPONDEE_G4_GRID_LIVE_TESTNET_E2E_EXECUTION_REQUIRED`

The local runner is:

`scripts/g4-sequential-live-e2e-localstorage.ps1`

It enforces the sequence:

`Grid -> Rebalancing only after Grid PASS -> Yield only after Rebalancing PASS`

Any failure terminates the sequence. No blind retry is authorized after a partial chain write.

## Truth and safety boundary

- BSC Testnet chain 97 only.
- Existing encrypted canonical seller wallet only.
- Seller password only via masked local prompt.
- Service price = 0.
- MegaFuel primary; ephemeral buyer must remain at 0 wei before/after.
- Local HTTP deliverable bridge required for manifest verification.
- All category scenarios and receipts remain `SIMULATION` evidence.
- No observed Agent Advantage claim.
- No mainnet/user capital/x402/paid spend/merge-to-main/final submission.
