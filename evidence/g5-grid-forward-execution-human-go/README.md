# Spondee G5 Grid Forward Observed Pair — Human Execution GO

Date: 2026-09-04

Gate: `SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_EXECUTION_REQUIRED`

Status: **AUTHORIZED BY HUMAN / NOT YET EXECUTED**

The human explicitly opened the protected execution gate in chat by sending the exact gate identifier.

Authorized scope is intentionally narrow:

- execute exactly one new **Grid G5** marketplace job on **BSC testnet**;
- service price must remain `0`;
- gas path must remain MegaFuel;
- canonical seller remains `0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8` using the existing encrypted local keystore only;
- jobs `949`, `954`, `955`, and `957` remain closed and must not be touched;
- BNB Chain mainnet access is Chainlink BNB/USD **read-only only**;
- no mainnet value movement, no meaningful user capital, no x402 payment, no material paid spend;
- freeze Promise/config before the forward observation window;
- collect the predeclared eight future Chainlink rounds under the runner's temporal rules;
- independently reread observed rounds by exact round ID;
- preserve transaction tape, input, market data, agent output, baseline output, timing and cost artifacts;
- compute the without-agent baseline on the exact same observed window;
- fail closed on timeout or first execution error;
- no blind retry and no second Grid G5 job without a new human gate;
- no merge to main and no final submission.

Validated runtime authority remains the preflight PASS:

- branch: `build/g5-grid-forward-observed`
- validated runtime head: `c59725553793e6927479077205d4e4a91a7e78bb`
- authoritative preflight CI: `33845758154` — PASS
- canonical runner: `scripts/g5-grid-forward-observed-pair.ps1 -Execute`
- exact execution seal: `SPONDEE_G5_GRID_FORWARD_HUMAN_GATE=SPONDEE_G5_GRID_FORWARD_OBSERVED_PAIR_EXECUTION_REQUIRED`

This record authorizes the bounded local execution only. It does **not** claim that a countable Agent Advantage pair exists yet.
