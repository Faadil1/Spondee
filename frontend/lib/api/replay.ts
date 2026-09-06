import { getBackendBaseUrl } from "./bootstrap";
import type { DecisionReplay, DecisionReplayFetchResult } from "./types";

export async function getDecisionReplay(activationId: string): Promise<DecisionReplayFetchResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/activations/${activationId}/replay`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 404) {
      return { status: "not_found", message: readError(body) ?? "Replay not found." };
    }

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Replay fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    const replay = readReplay(body);
    if (!replay) {
      return { status: "malformed", message: "Backend response did not include a valid Decision Replay.", received: body };
    }

    return { status: "success", replay };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

function readReplay(value: unknown): DecisionReplay | null {
  if (!isRecord(value) || !isRecord(value.replay)) return null;
  const replay = value.replay;
  if (replay.schema !== "spondee.decision-replay.v1") return null;
  if (replay.replay_mode !== "READ_ONLY_RECONSTRUCTION") return null;
  if (typeof replay.activation_id !== "string") return null;
  if (!isRecord(replay.truth) || replay.truth.reexecution_performed !== false) return null;
  if (!isRecord(replay.promise) || !isRecord(replay.inputs)) return null;
  if (!isRecord(replay.authority) || !Array.isArray(replay.timeline)) return null;
  return replay as DecisionReplay;
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
