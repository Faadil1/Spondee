# Spondee G5 — Observed Agent Advantage evidence preflight PASS

Date: 2026-09-04 UTC
Authoritative CI run: `33842602119`
Validated head: `5312e9084f6849b51c92bd7576e1073d0c7adc9b`

## Result

`SPONDEE_G5_OBSERVED_AGENT_ADVANTAGE_EVIDENCE_DESIGN_AND_PREFLIGHT = PASS`

## What passed

- backend regression tests
- strict TypeScript build
- strict `spondee.agent-advantage-pair.v1` validation contract
- SIMULATION -> OBSERVED promotion fails closed
- both agent and baseline runs must be OBSERVED
- pair category/scenario must match
- agent run must reference the exact baseline run
- raw `INPUT_SNAPSHOT`, `AGENT_OUTPUT`, and `BASELINE_OUTPUT` artifacts are mandatory
- at least one external observed source is mandatory
- Grid Trading requires a real record with observation window, outcomes and risk
- report remains insufficient below three pairs
- report remains insufficient with three non-trading pairs
- three validated pairs including Grid can reach `READY`
- protocol explicitly does not authorize meaningful mainnet/user capital

## Truth boundary

Existing G3/G4 receipts remain `SIMULATION` and count as zero observed Agent Advantage pairs.

The new schema does not itself create observed evidence. It only prevents invalid evidence from being promoted into the report.

## Next

Qualify the first Grid observed pair using external observed BNB market provenance and a frozen agent-vs-without-agent protocol before opening any experiment execution.
