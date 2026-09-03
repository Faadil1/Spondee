# Spondee Backend

**Agents, measured by what they deliver.**

This service is the shared marketplace/evidence backend behind Spondee. It gives all four required BNB Agent Studio categories the same product contract:

`Task -> Promise Card -> Activation -> Outcome Receipt -> Evidence / Calibration`

## Four first-class categories

- Health Factor Monitoring
- Grid Trading
- Rebalancing
- Yield Optimisation

All current built-in scenario engines are deterministic. Until real observed runs exist:

- `confidence = null`;
- `confidence_status = UNSCORED_UNTIL_OBSERVED_CALIBRATION`;
- simulation receipts are explicitly excluded from observed Agent Advantage;
- Grid never manufactures PnL;
- Yield never guarantees APR;
- Health never guarantees liquidation prevention;
- Rebalancing never claims live LP performance.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/healthz` | service health |
| GET | `/v1/categories` | four category surfaces + reference agents |
| GET | `/v1/agents?category=` | marketplace catalog |
| GET | `/v1/agents/:id` | agent detail |
| GET | `/v1/identity/:id` | ERC-8004 / 8004scan identity substrate metadata |
| POST | `/v1/promises/preview` | deterministic Promise Card before activation |
| GET | `/v1/promises/:id` | stored Promise Card |
| POST | `/v1/activations` | prepare simulation or live-testnet activation |
| GET | `/v1/activations/:id` | activation state |
| POST | `/v1/activations/:id/live-testnet` | protected signed ERC-8183 zero-price write path |
| GET | `/v1/receipts/:id` | Outcome Receipt |
| POST | `/v1/evidence/baselines` | preserve an explicit observed/simulation evidence run |
| GET | `/v1/evidence/agent-advantage` | observed-only Agent Advantage report |
| GET | `/v1/agents/:id/calibration` | observed-only calibration summary |
| GET | `/v1/runtime/readiness` | public BSC-testnet read probe + live gate status |

## Persistence

Without `DATABASE_URL`, the backend uses an in-memory store for CI/local demos.

With `DATABASE_URL`, it uses PostgreSQL. The deployable schema is in `sql/001_init.sql` and is also created idempotently by the PostgreSQL store on startup.

Stored durable objects:

- Promise Cards;
- activation/run state;
- Outcome Receipts;
- observed and simulation evidence runs.

The Evidence API preserves the fields needed for the TermiX Agent Advantage Report. A simulation can be stored for debugging, but it is automatically excluded from observed Agent Advantage.

## 8004scan / ERC-8004 policy

8004scan is **identity/capability substrate, not the Spondee product**. External agents may appear in the catalog as `DISCOVERY_ONLY_EXTERNAL`, but cannot emit a Spondee Promise Card until an actual activation adapter is verified. This prevents identity/reputation metadata from silently becoming a performance claim.

## ERC-8183 live path

The live driver follows the current BNB SDK pattern:

1. obtain a seller-signed quote over A2A;
2. verify provider address and quote signature;
3. verify the signed currency against the current Commerce payment token;
4. build the on-chain job description from the **same signed terms**;
5. `createJob`;
6. `registerJob`;
7. `setBudget(0)`;
8. `fund(0)`;
9. push `notify_funded` to the Studio-style seller;
10. poll the chain for `SUBMITTED`/`COMPLETED`;
11. resolve the deliverable URL.

The G3 service price is hard-fixed to zero. `fund(0)` still moves the ERC-8183 lifecycle to Funded without payment-token transfer.

### Fail-closed live gate

No live write can occur unless **all** are configured locally:

```text
SPONDEE_LIVE_TESTNET_ENABLED=true
SPONDEE_SELLER_A2A_URL=...
BUYER_WALLET_ADDRESS=0x...
BUYER_WALLETS_DIR=...
BUYER_WALLET_PASSWORD=...
```

The buyer should be a separate throwaway BSC-testnet Keystore V3 wallet. Never commit or paste passwords, private keys, seed phrases or keystore JSON.

Today/CI, the gate stays closed. The first real write is reserved for the explicit tBNB-backed testnet gate.

## Local

```bash
cd backend
npm install
npm test
npm run build
npm run smoke
npm run dev
```

The smoke command generates four Promise/Receipt pairs and performs **no chain write**.

## Current live boundary

Provider/seller wallet already verified locally:

`0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8`

It remains BSC-testnet-only. The backend must not be interpreted as proof of a live ERC-8183 activation until a real BSC-testnet transaction and Outcome Receipt are preserved.
