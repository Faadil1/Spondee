# Spondee — External Reconnaissance

Date: 2026-09-03
Purpose: bounded pre-build requirement validation only. This is not product implementation.

## BNB Agent Studio v2

Official BNB sources confirm:

- Studio can create agents from TypeScript or Python workflows.
- Agents can be deployed and registered on BSC with ERC-8004 identity.
- ERC-8183 job flow and x402 payment surfaces are available.
- BSC testnet flow is supported; managed testnet deployment and gas support reduce setup burden.
- Builders can create their own reference agents, so Spondee does not require a pre-existing public marketplace agent for every category before architecture can be selected.

Sources:
- https://www.bnbchain.org/en/blog/bnb-agent-studio-v2-your-agents-your-rules
- https://www.bnbchain.org/en/bnb-agent-studio
- https://docs.bnbchain.org/developer-kit/bnbchain-studio/quickstart/

## Altana

Official BNB source confirms Altana is a wallet option in Agent Studio and supports:

- spending limits;
- allowlists;
- time bounds;
- onchain-verifiable permissions;
- instant revocation.

Source:
- https://www.bnbchain.org/en/blog/altana-in-bnb-agent-studio-agents-with-limits-you-set

## 8004scan / live BSC evidence

8004scan currently exposes a very large BNB Smart Chain ERC-8004 registry and live examples relevant to Spondee's categories.

Examples observed during reconnaissance:

- `DeFiMatrix.agent` — active BSC agent, Agent ID 171927; describes personalized yield strategies and portfolio rebalancing from real-time DeFi data.
- `DeFi Trading Agent SperaxOS` — BSC agent, Agent ID 6441; describes automated DeFi yield optimization, liquidity-pool monitoring, swaps and yield-farming management.
- `Debot Trading Agent` / `Ave.ai Trading Agent` — active BSC trading-agent examples.

These prove relevant BSC agent supply exists, but they do **not** by themselves prove the exact Spondee activation path or official LP-range/Health-Factor category coverage.

Sources:
- https://8004scan.io/networks
- https://8004scan.io/agents/bsc/171927
- https://8004scan.io/agents/bsc/6441
- https://8004scan.io/agents/bsc/77658
- https://8004scan.io/agents/bsc/85550

## Pre-build conclusion

The product architecture does not depend on discovering a perfect pre-existing agent for every category: Spondee may build category-specific reference agents with Agent Studio and use 8004scan as the broader identity/discovery substrate.

Remaining verification belongs to runtime/build gates:

1. run Agent Studio environment preflight;
2. create/verify the first reference agent on BSC testnet;
3. freeze Promise Card and Outcome Receipt schemas against an actual run;
4. choose the cleanest Health Factor stress scenario/protocol.
