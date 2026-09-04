/**
 * A2A executor — the seller agent's outward A2A surface (two fixed-code
 * skills).
 *
 * The agent serves A2A directly (an `@a2a-js/sdk` express app on the
 * AgentCore A2A runtime contract). This module is ONLY the a2a wire:
 * {@link SellerAgentExecutor} inherits all of the seller logic +
 * background-delivery machinery from `sellerCore.ts` `SellerCore` (which
 * imports nothing from `@a2a-js/sdk`) and adds the a2a-specific
 * {@link SellerAgentExecutor.execute} / {@link SellerAgentExecutor.cancelTask}
 * entrypoints plus the request/response wire helpers. `execute` reads the
 * inbound message's data part and dispatches on its `skill`:
 *
 *     negotiate     → `SellerCore.negotiate` (rule-based price clamp + EIP-191 sign)
 *     notify_funded → `SellerCore.notifyFunded` (fast on-chain gate) → ACK at
 *                     once, then in the BACKGROUND: LLM work → `signing.submitResult`
 *
 * `notify_funded` is the buyer's "I funded job X — please deliver"
 * notification. Because the work takes time, the default executor path does
 * NOT block the caller: the core verifies the funded job synchronously (a
 * couple of eth_calls) to ACK accepted/rejected, then runs the slow work +
 * on-chain `submit` in a background task and replies immediately.
 *
 * Spondee's bounded local G4 proof may additionally set
 * `wait_for_result:true`. That opt-in path preserves the same verify-before-
 * work boundary but waits for the fixed-code submit result so the buyer can
 * read the exact submit transaction receipt without any historical log scan.
 * The default Agent Studio contract remains asynchronous.
 *
 * ALL signing is FIXED code in `signing.ts` — NEVER an LLM-callable tool
 * (money is never in the LLM; the LLM only produces the work text, via the
 * `runWork` hook). See `sellerCore.ts` for the negotiate / notifyFunded /
 * sweep logic.
 *
 * You own this file — specialise the work hook / dispatch in `sellerCore.ts`,
 * but keep signing OUT of the LLM tool list.
 */

import { randomUUID } from "node:crypto";
import type { DataPart, Message } from "@a2a-js/sdk";
import {
  A2AError,
  type AgentExecutor,
  type ExecutionEventBus,
  type RequestContext,
} from "@a2a-js/sdk/server";
import { isCommerceRateLimitError, limitCommerceOperation } from "./requestLimits.js";
import { parseJobId, SellerCore } from "./sellerCore.js";

const log = {
  error: (msg: string, e?: unknown) =>
    console.error(`[seller-agent.a2a] ERROR ${msg}`, e ?? ""),
};

/**
 * ERC-8183 seller A2A executor: the a2a wire over `SellerCore`.
 *
 * All seller logic (negotiate, notifyFunded, background delivery, `isBusy`,
 * the constructor bookkeeping, the `runWork` hook) lives in
 * `sellerCore.ts` `SellerCore`; this class adds only the A2A entrypoints and
 * request/response wire helpers.
 *
 * The agent exposes ONLY structured skills — there is no free-form chat
 * skill. A plain text message (no `{"skill": ...}` DataPart) is rejected.
 */
export class SellerAgentExecutor extends SellerCore implements AgentExecutor {
  /**
   * Spondee-only bounded sync extension for controlled local proof/recovery.
   *
   * The normal Agent Studio notify contract remains asynchronous. Only when
   * `wait_for_result:true` is explicitly supplied do we verify the named
   * FUNDED job and await its fixed-code submit result. This yields the exact
   * submit tx hash and deliverable URL without `eth_getLogs` discovery.
   */
  async notifyFunded(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (data.wait_for_result !== true) {
      return super.notifyFunded(data);
    }
    if (!this.skills().includes("notify_funded")) {
      throw new Error("8183 rail disabled");
    }
    await limitCommerceOperation("notify_funded");
    const raw = data.job_id;
    if (raw === undefined || raw === null || String(raw) === "") {
      return { status: "rejected", error: "wait_for_result requires job_id" };
    }
    let jobId: number;
    try {
      jobId = parseJobId(raw);
    } catch {
      return { status: "rejected", error: `invalid job_id: ${JSON.stringify(raw)}` };
    }
    const verified = await this.signing.verifySignedJob(jobId);
    if (!verified.ok) {
      return {
        status: "rejected",
        job_id: jobId,
        reason: verified.reason,
        permanent: verified.permanent,
      };
    }
    return this.doWorkAndSubmit(jobId, AbortSignal.timeout(120_000));
  }

  /**
   * Text-carrier entrypoint (Foundry invocations / responses SkillRouter).
   *
   * Same skill switch as {@link execute}, but NEVER throws: on a text
   * carrier there is no JSON-RPC error channel, so a fault is returned as an
   * `{"error": ...}` dict and the caller can always reply. The A2A path
   * keeps its own switch below because its fault semantics differ (faults
   * become JSON-RPC -32603 via A2AError).
   */
  async dispatch(
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const skill = data.skill;
    try {
      if (skill === "preview_health_factor") {
        return await this.previewHealthFactor(data);
      }
      if (skill === "negotiate") {
        return await this.negotiate(data);
      }
      if (skill === "notify_funded") {
        return await this.notifyFunded(data);
      }
      return {
        error: `unknown skill: ${JSON.stringify(skill)}`,
        skills: this.skills(),
      };
    } catch (e) {
      log.error(`skill ${JSON.stringify(skill)} failed`, e);
      if (isCommerceRateLimitError(e)) {
        return { status: "retry", error: "seller rate limit exceeded", skill };
      }
      return { error: "seller operation failed; retry later", skill };
    }
  }

  // ── A2A entrypoints ───────────────────────────────────────────────────────
  execute = async (
    context: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> => {
    const data = inbound(context);
    const skill = data.skill;
    let result: Record<string, unknown>;
    try {
      if (skill === "preview_health_factor") {
        result = await this.previewHealthFactor(data);
      } else if (skill === "negotiate") {
        result = await this.negotiate(data);
      } else if (skill === "notify_funded") {
        result = await this.notifyFunded(data);
      } else {
        result = {
          error: `unknown skill: ${JSON.stringify(skill)}`,
          skills: this.skills(),
        };
        if (skill === undefined) {
          result.hint =
            'send the skill envelope as an A2A data part: parts:[{"kind":"data","data":{"skill":"negotiate",...}}]';
        }
      }
    } catch (e) {
      log.error(`skill ${JSON.stringify(skill)} failed`, e);
      if (isCommerceRateLimitError(e)) {
        result = {
          status: "retry",
          error: "seller rate limit exceeded",
          skill,
        };
      } else {
        throw A2AError.internalError("seller operation failed; retry later");
      }
    }
    reply(eventBus, context, result);
  };

  cancelTask = async (
    _taskId: string,
    _eventBus: ExecutionEventBus,
  ): Promise<void> => {
    throw A2AError.unsupportedOperation("cancel");
  };
}

// ── wire helpers ──────────────────────────────────────────────────────────────

function inbound(context: RequestContext): Record<string, unknown> {
  const parts = context.userMessage?.parts ?? [];
  const dataPart = parts.find((p): p is DataPart => p.kind === "data");
  return dataPart?.data ?? {};
}

function reply(
  eventBus: ExecutionEventBus,
  context: RequestContext,
  data: Record<string, unknown>,
): void {
  const message: Message = {
    kind: "message",
    role: "agent",
    messageId: randomUUID(),
    parts: [{ kind: "data", data }],
    contextId: context.contextId,
    taskId: context.taskId,
  };
  eventBus.publish(message);
  eventBus.finished();
}