# Spondee Backend

**Agents, measured by what they deliver.**

Status: `BACKEND_CODE_COMPLETE_FOR_FRONTEND_V1`

This service is the shared marketplace/evidence backend behind Spondee. All four required BNB Agent Studio categories use the same product contract:

`Task -> Promise Card -> Activation -> Outcome Receipt -> Evidence / Calibration -> Decision Replay`

## Four first-class categories

- Health Factor Monitoring
- Grid Trading
- Rebalancing
- Yield Optimisation

All built-in scenario engines remain deterministic. Truth boundaries are enforced throughout the backend:

- `confidence = null` until observed calibration exists;
- simulation receipts are excluded from observed Agent Advantage;
- Grid never manufactures PnL;
- Yield never guarantees APR;
- Health never guarantees liquidation prevention;
- Rebalancing never claims live LP performance;
- external ERC-8004 discovery never becomes an activation/performance claim automatically.

## Frontend bootstrap

Primary frontend contract:

`GET /v1/product/bootstrap`

Schema:

`spondee.frontend-bootstrap.v1`

The bootstrap contains product definition, category presentation metadata, controlled agents, demo tasks, evidence/calibration state, capability matrix, runtime readiness and endpoint discovery.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/healthz` | service health |
| GET | `/v1/product/bootstrap` | stable frontend bootstrap contract |
| GET | `/v1/categories` | four category surfaces + reference agents |
| GET | `/v1/agents?category=` | controlled marketplace catalog |
| GET | `/v1/discovery/agents?search=&chain_id=&limit=` | server-side read-only 8004scan discovery |
| GET | `/v1/agents/:id` | agent detail |
| GET | `/v1/identity/:id` | ERC-8004 / 8004scan identity substrate metadata |
| GET | `/v1/promises` | Promise history |
| POST | `/v1/promises/preview` | deterministic Promise Card before activation |
| GET | `/v1/promises/:id` | stored Promise Card |
| GET | `/v1/activations` | activation history |
| POST | `/v1/activations` | prepare simulation or live-testnet activation |
| GET | `/v1/activations/:id` | activation state |
| GET | `/v1/activations/:id/replay` | read-only Decision Replay |
| POST | `/v1/activations/:id/live-testnet` | protected signed ERC-8183 zero-price write path |
| GET | `/v1/receipts` | Outcome Receipt history |
| GET | `/v1/receipts/:id` | Outcome Receipt |
| GET | `/v1/evidence/runs` | evidence history |
| GET | `/v1/evidence/runs/:id` | one evidence record |
| POST | `/v1/evidence/baselines` | protected immutable evidence ingestion |
| GET | `/v1/evidence/agent-advantage` | observed-only Agent Advantage report |
| GET | `/v1/agents/:id/calibration` | observed-only calibration summary |
| GET | `/v1/runtime/readiness` | BSC-testnet read probe + live/runtime/backend readiness |
| GET | `/v1/runtime/backend-readiness` | production configuration contract |

## Persistence

Without `DATABASE_URL`, the backend uses an in-memory store for local development/CI.

With `DATABASE_URL`, it uses PostgreSQL. The deployable schema is in `sql/001_init.sql` and is also created idempotently by the PostgreSQL store on startup.

Durable objects:

- Promise Cards;
- activation/run state;
- Outcome Receipts;
- observed and simulation evidence runs;
- operation locks used to protect consequential concurrent operations.

## Consequential mutation protection

Two independent server-only bearer scopes are required for protected endpoints:

```text
SPONDEE_ACTION_TOKEN=<random value >= 24 chars>
SPONDEE_EVIDENCE_INGEST_TOKEN=<different random value >= 24 chars>
```

They must never be embedded in browser bundles.

### Live action safety

`POST /v1/activations/:id/live-testnet` requires:

1. `SPONDEE_ACTION_TOKEN` authorization;
2. a LIVE_TESTNET activation;
3. activation state `PREPARED` or `BLOCKED_LIVE_GATE` only;
4. the explicit live runtime gate;
5. a durable operation lock before execution.

An activation that has advanced to `CHAIN_FUNDED`, `CHAIN_SUBMITTED`, `COMPLETED` or `FAILED` is not automatically retried. The caller must inspect state/Decision Replay and use an explicit recovery path instead of blindly producing another on-chain write.

### Evidence immutability

`POST /v1/evidence/baselines` requires `SPONDEE_EVIDENCE_INGEST_TOKEN`.

Evidence is immutable by `run_id`:

- identical retry -> `200` + `idempotent: true`;
- changed payload under the same `run_id` -> `409`;
- new record -> `201`.

This prevents silent rewriting of canonical observed evidence.

## Decision Replay

`GET /v1/activations/:id/replay`

Schema:

`spondee.decision-replay.v1`

Replay reconstructs preserved:

- task inputs;
- Promise Card;
- authority/mode/network;
- job and transaction references;
- Outcome Receipt;
- failure/update timeline.

Replay is **read-only reconstruction**. It performs no financial action and never promotes SIMULATION to OBSERVED.

## 8004scan / ERC-8004 discovery

Dynamic external discovery uses the official 8004scan REST API from the backend:

```text
SPONDEE_8004SCAN_API_BASE_URL=https://api.8004scan.io/api/v1
SPONDEE_8004SCAN_CACHE_SECONDS=60
# optional server-side only
SPONDEE_8004SCAN_API_KEY=...
```

External results are normalized as discovery records with:

- `activatable: false`;
- no inferred performance claim;
- no inferred Spondee activation claim.

Controlled Spondee reference agents remain the verified activation paths. Dynamic discovery can fail without invalidating those controlled paths.

## ERC-8183 live path

The live driver follows the BNB SDK pattern:

1. obtain seller-signed quote over A2A;
2. verify provider address and signature;
3. verify signed currency against current Commerce payment token;
4. build the on-chain job description from the same signed terms;
5. `createJob`;
6. `registerJob`;
7. `setBudget(0)`;
8. `fund(0)`;
9. push `notify_funded`;
10. resolve exact provider submit transaction/deliverable;
11. verify Outcome Receipt and preserved claim boundaries.

The service price remains hard-fixed to zero for the verified testnet paths.

## Live runtime gate

No live write can occur unless all are configured locally/server-side:

```text
SPONDEE_LIVE_TESTNET_ENABLED=true
SPONDEE_SELLER_A2A_URL=...
BUYER_WALLET_ADDRESS=0x...
BUYER_WALLETS_DIR=...
BUYER_WALLET_PASSWORD=...
SPONDEE_ACTION_TOKEN=...
```

The buyer wallet remains a separate throwaway BSC-testnet Keystore V3 wallet. Never commit or paste passwords, private keys, seed phrases or keystore JSON.

## Production deployment readiness

`GET /v1/runtime/backend-readiness` separates **code completeness** from **deployment configuration**.

Backend code can be complete while public deployment is still blocked because environment configuration is absent.

A production-ready configuration requires:

- `DATABASE_URL`;
- `SPONDEE_CORS_ORIGINS`;
- `SPONDEE_ACTION_TOKEN`;
- `SPONDEE_EVIDENCE_INGEST_TOKEN`.

The response never prints secret values.

## Local

```bash
cd backend
npm install
npm test
npm run build
npm run smoke
npm run dev
```

The smoke command generates four Promise/Receipt simulation pairs and performs **no chain write**.

## Current evidence boundary

Verified controlled live BSC-testnet transport jobs:

- Health Factor: `949`
- Grid: `954`
- Rebalancing: `955`
- Yield: `957`

First countable observed Agent Advantage pair:

- Grid job `962`
- agent terminal equity `$9,996.660009`
- baseline `$9,999.160009`
- measured delta `-$2.50`

This negative result is intentionally preserved. Backend code completion does **not** mean submission evidence is complete: two more countable observed pairs, the Health Factor observed event tape and public deployment remain separate evidence/runtime workstreams.
