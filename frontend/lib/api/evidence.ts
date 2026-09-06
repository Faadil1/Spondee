import { getBackendBaseUrl } from "./bootstrap";
import type {
  AgentAdvantageFetchResult,
  AgentAdvantageReport,
  CalibrationFetchResult,
  CalibrationSummary,
  EvidenceListResult,
  EvidenceRun,
  EvidenceRunFetchResult,
} from "./types";

export async function getAgentAdvantageReport(): Promise<AgentAdvantageFetchResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/evidence/agent-advantage`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Agent Advantage fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    if (!isRecord(body) || !isRecord(body.report) || typeof body.report.status !== "string") {
      return { status: "malformed", message: "Backend response did not include a valid Agent Advantage report.", received: body };
    }

    return { status: "success", report: body.report as AgentAdvantageReport };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

export async function listEvidenceRuns(): Promise<EvidenceListResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/evidence/runs`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Evidence list fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    if (!isRecord(body) || !Array.isArray(body.evidence)) {
      return { status: "malformed", message: "Backend response did not include an evidence run list.", received: body };
    }

    const evidence = body.evidence.map(readEvidenceRun);
    if (evidence.some((run) => run === null)) {
      return { status: "malformed", message: "Backend evidence list included an invalid run.", received: body };
    }

    return { status: "success", evidence: evidence as EvidenceRun[] };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

export async function getEvidenceRun(runId: string): Promise<EvidenceRunFetchResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/evidence/runs/${runId}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 404) {
      return { status: "not_found", message: readError(body) ?? "Evidence run not found." };
    }

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Evidence run fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    const evidence = isRecord(body) ? readEvidenceRun(body.evidence) : null;
    if (!evidence) {
      return { status: "malformed", message: "Backend response did not include a valid evidence run.", received: body };
    }

    return { status: "success", evidence };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

export async function getAgentCalibration(agentId: string): Promise<CalibrationFetchResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/agents/${agentId}/calibration`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 404) {
      return { status: "not_found", message: readError(body) ?? "Agent calibration not found." };
    }

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Calibration fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    if (!isRecord(body) || !isRecord(body.calibration) || typeof body.calibration.status !== "string") {
      return { status: "malformed", message: "Backend response did not include a valid calibration summary.", received: body };
    }

    return { status: "success", calibration: body.calibration as CalibrationSummary };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

function readEvidenceRun(value: unknown): EvidenceRun | null {
  if (!isRecord(value)) return null;
  if (typeof value.run_id !== "string") return null;
  if (value.evidence_class !== "OBSERVED" && value.evidence_class !== "SIMULATION") return null;
  if (typeof value.category !== "string" || typeof value.agent_id !== "string") return null;
  if (!Array.isArray(value.tx_hashes) || !Array.isArray(value.output_artifacts)) return null;
  return value as EvidenceRun;
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
