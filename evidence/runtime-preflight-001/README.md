# Spondee Runtime Preflight 001 — Raw Evidence Summary

Date: 2026-09-03
GitHub Actions run: https://github.com/Faadil1/Spondee/actions/runs/33752070626
Workflow commit: `d766d2ff9abec2c5e1f934d6331ec534a405d0a7`
Artifact ID: `9891943363`
Artifact digest: `sha256:aa77d354a2098baa21558ee036665ec09f1f93443a10a956acbc422cb34a656c`

## Runtime

```text
node=v22.23.2
npm=10.9.8
python=Python 3.12.3
pnpm=10.34.5
@bnbagent/studio-cli=0.0.13
```

## BSC testnet RPC

```json
{"jsonrpc":"2.0","id":1,"result":"0x61"}
```

Official BSC testnet chain ID: 97 / `0x61`.

## Scaffold

Command family:

```text
bag init spondeehealth --network bsc-testnet --wallet-kind evm-local --protocols A2A,MCP,X402 --storage-provider local --no-onboard --ide both
```

Result:

```text
exit_code=0
network.default = "bsc-testnet"
```

Generated workspace includes `agentcore/` and `app/agent/`; dependencies installed with pnpm.

## bag scan

```json
{
  "path": "/home/runner/work/_temp/spondee-preflight/spondeehealth",
  "is_studio_project": true,
  "has_studio_toml": false,
  "has_package_json": true,
  "has_agentcore_json": true,
  "deploy_ready": true,
  "has_dot_studio_dir": true,
  "project_name": "spondeehealth-workspace",
  "role": "none",
  "has_agent_layer": false,
  "package_manager": "pnpm",
  "recipes_emitted": []
}
```

`scan_exit_code=0`.

## bag doctor

`doctor_exit_code=0`.

PASS checks:
- `studio.toml` parseable;
- agent entrypoint present (`src/dualMain.ts`);
- Pieverse `auto/free` model exists;
- network reachable on `bsc-testnet`;
- ERC-8183 pricing configuration valid;
- x402 pricing configuration valid;
- managed-platform storage recognized;
- zero-deposit Pieverse mode recognized;
- ZIP bundle esbuild dry run passes;
- Agent Studio skill trigger present.

Expected pre-onboarding warnings:
- no wallet keystore yet — create with `bag wallet new`;
- `WALLET_PASSWORD` not set;
- `PIEVERSE_LLM_API_KEY` not set / Pieverse not activated;
- `[payments.erc8183].max_price` not yet set;
- B402 merchant credentials absent, so paid x402 rail remains dormant;
- Bun 1.3+ absent, required before deployment.

These warnings are intentionally preserved. No secret, wallet key, paid credential, funded transaction or mainnet action was used in this preflight.

## Classification

`RUNTIME_PREFLIGHT_PASS_WITH_EXPECTED_ONBOARDING_GAPS`

The environment can install Agent Studio, reach BSC testnet, scaffold a Spondee reference-agent workspace, parse/diagnose it successfully, and bundle the generated agent. Wallet creation, LLM activation, pricing clamp configuration, local live smoke and deployment are G3 implementation steps, not PRD-definition blockers.
