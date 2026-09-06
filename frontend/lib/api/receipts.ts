import { getBackendBaseUrl } from "./bootstrap";
import type { OutcomeReceipt, ReceiptFetchResult } from "./types";

export async function getReceipt(receiptId: string): Promise<ReceiptFetchResult> {
  try {
    const response = await fetch(`${getBackendBaseUrl()}/v1/receipts/${receiptId}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const body: unknown = await response.json().catch(() => null);

    if (response.status === 404) {
      return { status: "not_found", message: readError(body) ?? "Receipt not found." };
    }

    if (!response.ok) {
      return {
        status: "server_error",
        message: readError(body) ?? `Receipt fetch failed with HTTP ${response.status}.`,
        details: readDetails(body),
      };
    }

    const receipt = readReceipt(body);
    if (!receipt) {
      return { status: "malformed", message: "Backend response did not include a valid receipt.", received: body };
    }

    return { status: "success", receipt };
  } catch (error) {
    return {
      status: "unavailable",
      message: error instanceof Error ? error.message : "Backend is unavailable.",
    };
  }
}

function readReceipt(value: unknown): OutcomeReceipt | null {
  if (!isRecord(value) || !isRecord(value.receipt)) return null;
  const receipt = value.receipt;
  if (receipt.schema !== "spondee.outcome-receipt.v1") return null;
  if (typeof receipt.receipt_id !== "string") return null;
  if (receipt.evidence_class !== "SIMULATION") return null;
  if (!isRecord(receipt.actual_outcome)) return null;
  if (!isRecord(receipt.actual_cost)) return null;
  if (!Array.isArray(receipt.tx_hashes)) return null;
  return receipt as OutcomeReceipt;
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
