# Spondee G4 — Four-Category Live Path Qualification

Date: 2026-09-04 UTC
Gate: `SPONDEE_G4_FOUR_CATEGORY_LIVE_PATH_QUALIFICATION_REQUIRED`
Action class: `READ_ONLY_RECONNAISSANCE_AND_QUALIFICATION`

## Executive result

`PASS_WITH_ACTIVATION_PROOF_FOLLOW_ON_REQUIRED`

The killing assumption that the three remaining categories have no credible BSC-live candidate path is reduced: credible ERC-8004/BSC candidates exist for Grid Trading, Rebalancing and Yield Optimisation, and BNB Agent Studio provides a controlled Spondee-owned fallback path for each category.

However, candidate existence/registration is not equivalent to successful marketplace activation. No external candidate is promoted to `activatable=true` until its advertised A2A/task surface is directly verified and a bounded invocation path is demonstrated. The next gate therefore remains read-only and probes those public task surfaces before any consequential deployment or wallet action.

## Official constraints reconfirmed

BNB Chain's current Smart Money Era marketplace brief requires:

- all four categories as first-class surfaces;
- the full `land -> find -> understand -> activate` journey without dead ends;
- agents surfaced as activatable to be live on BSC;
- real onchain transactions through a session key, with user-facing permission/revoke controls;
- at least three real Agent Advantage paired tasks, including one trading/security task.

Official Agent Studio v2 confirms:

- TypeScript Agent Studio agents can deploy/register on BSC;
- ERC-8004 identity + ERC-8183 task interface are standard Studio surfaces;
- testnet gas can be paymaster-sponsored;
- Altana is available for onchain-verifiable scoped session keys with spend limits, allowlists, expiry and revocation.

These facts qualify the Spondee-owned Agent Studio fallback architecture without authorizing its deployment in this gate.

## Qualification matrix

### 1. Grid Trading

Primary candidate: **DeFiBot.agent**

- ERC-8004 token/agent id: `172801`
- Network: BNB Smart Chain mainnet (`chain 56`)
- Owner / agent wallet: `0x7c0e462721195a7cfeea4cb7d65ee6ffa142fde2`
- Registry registration: independently cross-checked as mined according to the discovery evidence reviewed.
- Category fit: strong — description explicitly says `grid trading`, DCA and yield compounding across DEXs.
- Onchain wallet activity: non-zero transaction history reported by the evidence layer.
- Advertised protocol: A2A.
- Current Spondee classification: `QUALIFIED_DISCOVERY_PRIMARY__ACTIVATION_NOT_PROVEN`.

Key blocker:

- the registry endpoint-verification signal is not positive; no Spondee-controlled read-only task invocation has yet proved the concrete A2A card/task surface for this agent.
- no observed Agent Advantage benchmark exists for it.

Fallback 1: **TradePilot.agent** (`177310`), registered BSC agent advertising DCA/grid/rebalancing strategies and A2A, but its endpoint is likewise not registry-verified and no Spondee invocation proof exists.

Controlled fallback 2: **Spondee Grid**. The deterministic backend engine already exists; if external invocation proof fails, specialize/deploy the same Agent Studio seller shape proven by Health Factor, preserving the shared Promise -> Activation -> Receipt contract. This is a build fallback, not yet live.

Recommendation: probe DeFiBot's advertised A2A/task surface first. If it cannot be verified quickly, switch immediately to the Spondee-owned Agent Studio fallback rather than spending the schedule on opaque external activation.

### 2. Rebalancing

Primary candidate: **BNB LP Range Rebalancer**

- ERC-8004 token/agent id: `265375`
- Network: BNB Smart Chain mainnet (`chain 56`)
- Owner / agent wallet: `0x20f1ca5d1e5a3ee94c29dbf95e6bf6cea6a8d64b`
- Registration transaction: `0x5b9a412ad3157f54ca94c18a547bb5c69bfaeee4c96fdd11dedf949c586c40fb`
- Registered block: `115479018`
- Category fit: very strong — specifically describes autonomous PancakeSwap V3 BNB/USDT concentrated-liquidity range rebalancing.
- Advertised protocol: A2A; x402 support is also advertised by the candidate metadata.
- Advertised A2A card: `https://bnb-lp.172-104-171-139.nip.io/.well-known/agent-card.json`
- A downstream evidence layer recorded a successful `pancakeswap-liquidity-intelligence` execution, while also correctly noting that no individual onchain execution transaction beyond registration was attributable from its public RPC scan.
- Current Spondee classification: `QUALIFIED_PRIMARY__PUBLIC_A2A_SURFACE_ADVERTISED__ONCHAIN_TASK_EXECUTION_NOT_PROVEN`.

Key blockers:

- endpoint is advertised but not registry-verified;
- task-level ERC-8183/onchain execution evidence must not be inferred from the description;
- no Spondee-controlled activation has been performed.

Fallback 1: **positioncrew-lp-rebalance.agent** (`266231`), BSC registered and explicitly evaluates PancakeSwap V3 range shifts/HOLD decisions.

Controlled fallback 2: **Spondee Rebalancing**, whose deterministic LP range-exit/reset engine already exists and can reuse the proven Agent Studio seller transport if external activation is unreliable.

Recommendation: this is the strongest external candidate in the three-category set. Probe its public A2A card/task interface first and prefer external discovery/invocation if the surface is stable; otherwise use Spondee-owned deployment.

### 3. Yield Optimisation

Primary candidate: **DeFi Trading Agent SperaxOS**

- ERC-8004 token/agent id: `6441`
- Network: BNB Smart Chain mainnet (`chain 56`)
- Owner / agent wallet: `0x9c2499e3695728b2b7a6be4242ffccef56a8a360`
- Direct 8004scan status: active/live registration on BSC.
- Description: monitors liquidity pools, executes token swaps, manages yield-farming positions and performs market analysis across DEXs.
- Advertised protocols in the reviewed marketplace evidence: A2A + Web.
- Current Spondee classification: `QUALIFIED_DISCOVERY_PRIMARY__ACTIVATION_NOT_PROVEN`.

Key blocker:

- registration/activity does not itself prove a task invocation or liquidity-routing transaction through Spondee;
- the current public permission examples are not sufficient to claim a correct production yield-routing scope.

Fallback 1: **DeFiMatrix.agent** (`171927`). Direct 8004scan shows it active on BSC, with personalized yield strategies and portfolio rebalancing using real-time DeFi data. It is already represented in the Spondee catalog as discovery-only and must remain `activatable=false` until task invocation is proven.

Fallback 2: **positioncrew-yield-optimizer.agent** (`266232`) is a BSC candidate explicitly focused on block-pinned Venus stablecoin markets and bounded allocation/HOLD decisions.

Controlled fallback 3: **Spondee Yield**, whose deterministic risk-bounded yield comparison engine already exists and can be specialized into the proven Agent Studio seller template.

Recommendation: probe SperaxOS first because it combines live ERC-8004 identity with an explicitly executable DeFi description. If the external task surface is opaque or unstable, fall back to the Spondee-owned Agent Studio path rather than trying to prove mainnet strategy execution under deadline pressure.

## Cross-category architecture recommendation

Use a hybrid three-layer model:

1. **Discovery / identity:** 8004scan / ERC-8004 remains the canonical external discovery substrate.
2. **Marketplace evidence:** Spondee builds its Promise Card, evidence quality and truthful `activatable` classification around the discovered agent.
3. **Activation:** use an external agent only after its task surface is directly verified; otherwise route the category to the corresponding Spondee Agent Studio reference agent once that fallback is explicitly built/deployed.

Do not claim that an ERC-8004 registration, wallet nonce, advertised A2A endpoint or third-party `Activate` button proves successful Spondee activation.

## Candidate status summary

| Category | Primary | BSC identity | Category fit | Public task surface | Spondee activatable now? | Controlled fallback |
|---|---|---:|---:|---|---:|---|
| Grid Trading | DeFiBot.agent #172801 | VERIFIED | STRONG | A2A advertised; direct invocation not yet proven | NO | Spondee Grid / Agent Studio |
| Rebalancing | BNB LP Range Rebalancer #265375 | VERIFIED | VERY STRONG | concrete A2A card advertised; direct Spondee invocation pending | NO | Spondee Rebalancing / Agent Studio |
| Yield Optimisation | SperaxOS #6441 | VERIFIED | STRONG | A2A/Web advertised; direct invocation not yet proven | NO | Spondee Yield / Agent Studio |

## Gate decision

`G4_LIVE_PATH_QUALIFICATION = PASS_WITH_READ_ONLY_ENDPOINT_PROBE_REQUIRED`

A-01 is no longer `NO_CANDIDATE_PATH_FOUND`; it becomes `CANDIDATES_QUALIFIED__ACTIVATION_SURFACE_UNVERIFIED`.

No candidate is promoted to `activatable=true` from this evidence alone.

## Exact next gate

`SPONDEE_G4_EXTERNAL_A2A_TASK_SURFACE_READ_ONLY_PROBE_REQUIRED`

Required output:

1. Fetch/validate the advertised Agent Card or service metadata for the three primaries.
2. Confirm the card belongs to the expected ERC-8004 agent and exposes a usable task/invocation surface.
3. Record auth/payment requirements without sending payment or signing anything.
4. Mark each path `EXTERNAL_ACTIVATION_FEASIBLE` or `EXTERNAL_ACTIVATION_NOT_PROVEN`.
5. If a primary fails quickly, probe its named fallback; if no external path proves cleanly, promote the Spondee-owned Agent Studio build fallback for that category.

## Current safety boundary

Still forbidden in this gate:

- new live ERC-8183 jobs;
- seller-wallet unlock;
- tBNB acquisition;
- mainnet/user-capital action;
- remaining-category deployment;
- Altana grantSession writes;
- PancakeSwap transactions;
- merge to `main`;
- Project Finisher;
- final submission.

## Sources reviewed

Official / primary:

- BNB Chain Smart Money Era marketplace track: https://www.bnbchain.org/en/hackathons/smart-money-era?tab=tracks
- BNB Agent Studio: https://www.bnbchain.org/en/bnb-agent-studio
- BNB Agent Studio v2: https://www.bnbchain.org/en/blog/bnb-agent-studio-v2-your-agents-your-rules
- BNB Agent Studio quickstart: https://docs.bnbchain.org/developer-kit/bnbchain-studio/quickstart/
- 8004scan DeFiMatrix.agent #171927: https://8004scan.io/agents/bsc/171927
- 8004scan DeFi Trading Agent SperaxOS #6441: https://8004scan.io/agents/bsc/6441

Secondary discovery/evidence used only for triage and cross-checking, not as canonical product authority:

- AgentOS BNB LP Range Rebalancer #265375
- AgentOS DeFiBot.agent #172801
- AgentOS TradePilot.agent #177310
- AgentOS positioncrew-lp-rebalance.agent #266231
- AgentOS marketplace/yield category pages

Environment note: a direct HTTP probe from the available local container could not resolve public DNS, so no endpoint success/failure claim is inferred from that tool limitation. Public task-surface verification remains the explicit next read-only gate.