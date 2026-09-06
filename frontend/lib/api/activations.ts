import { getBackendBaseUrl } from "./bootstrap";
import type {
  ActivationCreateResult,
  ActivationFetchResult,
  ActivationListResult,
  ActivationMode,
  ActivationRecord,
  SpondeeTask,
} from "./types";

export async function createActivation({
  promiseId,
  task,
  mode,
}: {
  promiseId: string;
  task: SpondeeTask;
  mode: ActivationMode;
}): Promise<ActivationCreateResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/activations`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ promise_id: promiseId, task, mode }),
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 400) {
      return {
        status: "validation_error",
        message: readError(body) ?? "Activation request failed backend validation.",
        details: readDetails(body),
      };
    }

    if (response.status === 404) {
      return { status: "not_found", message: readError(body) ?? "Promise not found." };
    }

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Activation failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    const activation = readActivation(body);
    if (!activation) {
      return {
        status: "server_error",
        message: "Backend response did not include an activation record.",
        details: body,
      };
    }

    return { status: "success", activation };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

export async function getActivation(activationId: string): Promise<ActivationFetchResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/activations/${activationId}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 404) {
      return { status: "not_found", message: readError(body) ?? "Activation not found." };
    }

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Activation fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    const activation = readActivation(body);
    if (!activation) {
      return { status: "malformed", message: "Backend response did not include a valid activation.", received: body };
    }

    return { status: "success", activation };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

export async function listActivations(): Promise<ActivationListResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/activations`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Activation list fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    if (!isRecord(body) || !Array.isArray(body.activations)) {
      return { status: "malformed", message: "Backend response did not include an activation list.", received: body };
    }

    const activations = body.activations.map(readActivation);
    if (activations.some((activation) => activation === null)) {
      return { status: "malformed", message: "Backend activation list included an invalid activation.", received: body };
    }

    return { status: "success", activations: activations as ActivationRecord[] };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

function readActivation(value: unknown): ActivationRecord | null {
  if (!isRecord(value)) return null;
  const activation = isRecord(value.activation) ? value.activation : value;
  if (typeof activation.activation_id !== "string") return null;
  if (!isActivationStatus(activation.status)) return null;
  return activation as ActivationRecord;
}

function isActivationStatus(value: unknown) {
  return (
    value === "PREPARED" ||
    value === "SIMULATED" ||
    value === "BLOCKED_LIVE_GATE" ||
    value === "CHAIN_FUNDED" ||
    value === "CHAIN_SUBMITTED" ||
    value === "COMPLETED" ||
    value === "FAILED"
  );
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
