# Spondee G4 — External A2A / Task Surface Read-Only Probe

Date: 2026-09-04 UTC
Gate: `SPONDEE_G4_EXTERNAL_A2A_TASK_SURFACE_READ_ONLY_PROBE_REQUIRED`
Action class: `READ_ONLY_ENDPOINT_AND_TASK_SURFACE_PROBE`

## Result

`FAIL_CLOSED_EXTERNAL_ACTIVATION_NOT_PROVEN__CONTROLLED_SPONDEE_FALLBACKS_PROMOTED`

This is not a project failure. It is a truth-preserving routing decision.

The three primary external ERC-8004 candidates remain useful for discovery, identity and comparison, but their public task surfaces are not proven strongly enough for Spondee to set `activatable=true` under the hackathon's no-dead-end activation requirement.

Therefore:

- external candidates remain `DISCOVERY/COMPARISON` sources;
- Spondee-owned Agent Studio reference-agent paths become the preferred activation build path for Grid, Rebalancing and Yield;
- no external payment, signing, session grant or transaction was performed.

## Standard used

The A2A specification treats the Agent Card as the discovery surface that identifies the agent's capabilities and interaction requirements. A marketplace should not infer callable task semantics from ERC-8004 registration alone.

Spondee's standard is stricter than 'a registry row exists':

1. expected ERC-8004 identity must be known;
2. an Agent Card/service surface must be reachable/verifiable;
3. task semantics and auth/payment requirements must be inspectable;
4. only then may an external path advance toward activatable status.

## Grid Trading — DeFiBot.agent #172801

Observed:

- BSC/ERC-8004 registration is cross-checked.
- Category fit is strong: grid trading, DCA and yield compounding are explicitly described.
- A2A is advertised.
- Non-zero agent-wallet activity exists.

Blocking finding:

- the reviewed evidence explicitly reports the advertised TermiX endpoint as **not registry-verified**;
- no Spondee-controlled Agent Card/task invocation proof exists;
- no observed performance benchmark exists.

Decision:

`EXTERNAL_ACTIVATION_NOT_PROVEN`

Primary activation path promoted for build:

`SPONDEE_GRID_AGENT_STUDIO`

The external agent may still be shown as discovery/comparison data with transparent evidence quality.

## Rebalancing — BNB LP Range Rebalancer #265375

Observed:

- BSC/ERC-8004 registration is independently cross-checked.
- Category fit is very strong and specific to PancakeSwap V3 concentrated-liquidity range management.
- Advertised A2A card: `https://bnb-lp.172-104-171-139.nip.io/.well-known/agent-card.json`.
- x402 is advertised.
- a downstream evidence layer records one successful `pancakeswap-liquidity-intelligence` execution through its own system.

Blocking finding:

- the candidate's endpoint-verification signal is not positive;
- the downstream execution is not a Spondee invocation and does not prove the marketplace's own task/hire path;
- no attributable strategy-execution transaction beyond registration is available from the reviewed public evidence.

Decision:

`EXTERNAL_ACTIVATION_NOT_PROVEN_FOR_SPONDEE`

Primary activation path promoted for build:

`SPONDEE_REBALANCING_AGENT_STUDIO`

This external candidate remains the strongest rebalancing discovery/comparison entry and can be revisited after the core judge path is safe.

## Yield Optimisation — DeFi Trading Agent SperaxOS #6441

Observed:

- direct 8004scan/BSC identity is live.
- description explicitly includes liquidity-pool monitoring, swaps and yield-farming position management.
- A2A + Web are advertised in the reviewed marketplace evidence.
- SperaxOS also exposes a public MCP/DeFi-agent ecosystem for market/yield data.

Blocking finding:

- no Spondee-controlled callable Agent Card/task surface was verified for #6441;
- related Sperax metadata reviewed elsewhere has endpoint verification failures/404s, so endpoint availability must not be assumed from the brand or description;
- permission examples reviewed are not sufficient to claim a correct end-to-end yield-routing execution scope.

Decision:

`EXTERNAL_ACTIVATION_NOT_PROVEN`

Primary activation path promoted for build:

`SPONDEE_YIELD_AGENT_STUDIO`

SperaxOS and DeFiMatrix remain useful discovery/comparison candidates.

## Fallback promotion decision

The external discovery layer remains valuable because the official marketplace brief rewards useful real data and agent diversity. But the activation layer should not depend on unverified third-party task surfaces under a Sep 9 deadline.

Promoted activation build paths:

| Category | Activation build path |
|---|---|
| Grid Trading | `Spondee Grid` Agent Studio reference agent |
| Rebalancing | `Spondee Rebalancing` Agent Studio reference agent |
| Yield Optimisation | `Spondee Yield` Agent Studio reference agent |

All three already have deterministic backend Promise/Receipt engines. The Health Factor G3 runtime proves the shared Agent Studio / compact Promise commitment / ERC-8183 / MegaFuel transport shape. The next build should reuse that shape rather than invent three unrelated stacks.

## Architecture after probe

`8004scan/ERC-8004 discovery -> Spondee evidence/Promise layer -> verified external activation OR Spondee-controlled Agent Studio activation`

For the Sep 9 judge path, activation defaults to the Spondee-controlled path for the three remaining categories until an external path later earns equivalent proof.

## Exact next gate

`SPONDEE_G4_THREE_REFERENCE_AGENTS_BUILD_AND_CI_REQUIRED`

Scope:

1. Specialize three Agent Studio reference-agent workspaces or category modules from the proven Health Factor seller shape.
2. Reuse shared Promise Card / compact commitment / Outcome Receipt contracts.
3. Keep service price zero and BSC testnet for CI/preflight.
4. Add category-specific deterministic task validation and negative paths.
5. Build/CI all three without deploying or creating live ERC-8183 jobs yet.
6. Keep external candidates in discovery data with `activatable=false` until separately proven.

## Safety boundary

Still not authorized by this record:

- live deployment of the three new agents;
- ERC-8183 createJob/fund/submit for the new categories;
- seller-wallet unlock;
- tBNB acquisition;
- x402 payment;
- Altana session grant;
- PancakeSwap/Venus/Lista transaction;
- mainnet/user capital;
- merge to main;
- Project Finisher;
- final submission.

## Sources

- A2A discovery/Agent Card specification: https://github.com/a2aproject/A2A/blob/main/docs/specification.md
- BNB Chain Smart Money Era marketplace brief: https://www.bnbchain.org/en/hackathons/smart-money-era?tab=tracks
- BNB Agent Studio v2: https://www.bnbchain.org/en/blog/bnb-agent-studio-v2-your-agents-your-rules
- DeFiBot.agent evidence reviewed via AgentOS/8004scan-derived data
- BNB LP Range Rebalancer evidence reviewed via AgentOS/8004scan-derived data
- DeFi Trading Agent SperaxOS direct 8004scan + AgentOS/8004scan-derived data

Environment note: the container available to this orchestration session could not resolve public DNS for direct raw HTTP calls. That runtime limitation was treated as neither endpoint success nor endpoint failure. The decisions above rely only on independently reviewed metadata/evidence signals and fail closed where direct Spondee invocation proof is absent.