"use client";

import { getBackendBaseUrl } from "./bootstrap";
import type { PromiseCard, PromisePreviewResult, SpondeeTask } from "./types";

export async function previewPromise(task: SpondeeTask, agentId: string): Promise<PromisePreviewResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/promises/preview`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task, agent_id: agentId }),
    });

    const body: unknown = await response.json().catch(() => null);

    if (response.status === 400) {
      return {
        status: "validation_error",
        message: readError(body) ?? "The task did not pass backend validation.",
        details: readDetails(body),
      };
    }

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Promise preview failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    const promise = readPromise(body);
    if (!promise) {
      return {
        status: "server_error",
        message: "Backend response did not include a Promise Card.",
        details: body,
      };
    }

    return { status: "success", promise };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

function readPromise(value: unknown): PromiseCard | null {
  if (!isRecord(value) || !isRecord(value.promise)) return null;
  if (value.promise.schema !== "spondee.promise-card.v1") return null;
  return value.promise as PromiseCard;
}

function readError(value: unknown): string | null {
  return isRecord(value) && typeof value.error === "string" ? value.error : null;
}

function readDetails(value: unknown): unknown {
  return isRecord(value) ? value.details : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
