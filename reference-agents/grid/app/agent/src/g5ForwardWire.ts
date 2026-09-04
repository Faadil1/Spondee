import {
  G5_GRID_FEED,
  G5_GRID_TASK_PREFIX,
  decodeForwardTask,
  type ForwardTask,
} from "./g5ForwardObserved.js";

export const G5_GRID_TASK_PREFIX_V2 = "SG5F2:";
const CLAIM_GUARDRAIL = "Forward observed-market-data task only. No mainnet trade is executed; paper returns are not realized PnL and do not guarantee future performance.";

export function decodeForwardWireTask(value: unknown): ForwardTask | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith(G5_GRID_TASK_PREFIX_V2)) return decodeForwardTask(value);
  try {
    const tuple = JSON.parse(Buffer.from(value.slice(G5_GRID_TASK_PREFIX_V2.length), "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(tuple) || tuple.length !== 13) return null;
    const [scenarioId, roundId, priceUsd, updatedAt, frozenAt, targetRounds, maxWait, pollSeconds, capitalUsd, levels, halfWidthPct, feeBps, slippageBps] = tuple;
    const full = {
      schema: "spondee.grid-forward-observed.task.v1",
      scenario_id: scenarioId,
      evidence_class: "OBSERVED",
      source: { chain_id: 56, network: "bsc-mainnet", feed_address: G5_GRID_FEED, feed_description: "BNB / USD" },
      freeze: { round_id: roundId, price_usd: priceUsd, updated_at: updatedAt, frozen_at: frozenAt },
      observation_rule: { only_rounds_after_activation: true, target_future_rounds: targetRounds, max_wait_seconds: maxWait, poll_seconds: pollSeconds },
      strategy: {
        capital_usd: capitalUsd,
        starting_allocation: "50% USD / 50% BNB",
        levels,
        half_width_pct: halfWidthPct,
        fee_bps: feeBps,
        slippage_bps: slippageBps,
        baseline: "STATIC_50_50_BUY_AND_HOLD",
      },
      claim_guardrail: CLAIM_GUARDRAIL,
    };
    const legacy = `${G5_GRID_TASK_PREFIX}${Buffer.from(JSON.stringify(full), "utf8").toString("base64url")}`;
    return decodeForwardTask(legacy);
  } catch {
    return null;
  }
}
