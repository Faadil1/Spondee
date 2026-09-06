import type {
  AgentRecord,
  BootstrapResponse,
  BootstrapResult,
  CategoryEntry,
  CategoryName,
} from "./types";

const FRONTEND_BOOTSTRAP_SCHEMA = "spondee.frontend-bootstrap.v1";
const DEFAULT_BACKEND_URL = "http://localhost:8787";

export function getBackendBaseUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SPONDEE_BACKEND_URL ?? DEFAULT_BACKEND_URL);
}

export async function getProductBootstrap(): Promise<BootstrapResult> {
  const backendBaseUrl = getBackendBaseUrl();

  try {
    const response = await fetch(`${backendBaseUrl}/v1/product/bootstrap`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        status: "unavailable",
        backendBaseUrl,
        message: `Backend returned HTTP ${response.status}`,
      };
    }

    const received: unknown = await response.json();
    const validation = validateBootstrap(received);

    if (!validation.ok) {
      return {
        status: "malformed",
        backendBaseUrl,
        received,
        message: validation.message,
      };
    }

    return { status: "success", data: validation.data, backendBaseUrl };
  } catch (error) {
    return {
      status: "unavailable",
      backendBaseUrl,
      message: error instanceof Error ? error.message : "Unknown bootstrap fetch failure",
    };
  }
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_BACKEND_URL;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

type BootstrapValidation =
  | { ok: true; data: BootstrapResponse }
  | { ok: false; message: string };

function validateBootstrap(value: unknown): BootstrapValidation {
  if (!isRecord(value)) return invalid("Bootstrap response is not an object");
  if (value.schema !== FRONTEND_BOOTSTRAP_SCHEMA) return invalid("Unexpected bootstrap schema");
  if (!isRecord(value.product) || typeof value.product.tagline !== "string") {
    return invalid("Missing product metadata");
  }
  if (!Array.isArray(value.categories)) return invalid("Missing categories array");
  if (!Array.isArray(value.agents)) return invalid("Missing agents array");
  if (!Array.isArray(value.demo_tasks)) return invalid("Missing demo_tasks array");
  if (!isRecord(value.runtime) || typeof value.runtime.live_testnet_write_ready !== "boolean") {
    return invalid("Missing runtime readiness");
  }
  if (!isRecord(value.evidence) || !isRecord(value.evidence.agent_advantage_report)) {
    return invalid("Missing evidence summary");
  }
  if (!value.categories.every(isCategoryEntry)) return invalid("One or more categories are malformed");
  if (!value.agents.every(isAgentRecord)) return invalid("One or more agents are malformed");
  return { ok: true, data: value as BootstrapResponse };
}

function invalid(message: string) {
  return { ok: false as const, message };
}

function isCategoryEntry(value: unknown): value is CategoryEntry {
  if (!isRecord(value)) return false;
  return isCategoryName(value.category) && isRecord(value.presentation) && isAgentRecord(value.reference_agent);
}

function isAgentRecord(value: unknown): value is AgentRecord {
  if (!isRecord(value)) return false;
  return (
    typeof value.agent_id === "string" &&
    typeof value.name === "string" &&
    isCategoryName(value.category) &&
    typeof value.description === "string" &&
    typeof value.activatable === "boolean" &&
    isRecord(value.identity) &&
    typeof value.identity.source === "string" &&
    typeof value.identity.network === "string" &&
    isRecord(value.activation_proof) &&
    Array.isArray(value.capabilities)
  );
}

function isCategoryName(value: unknown): value is CategoryName {
  return (
    value === "Health Factor Monitoring" ||
    value === "Grid Trading" ||
    value === "Rebalancing" ||
    value === "Yield Optimisation"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
