import type { ActivationStatus } from "@/lib/api/types";

export const terminalActivationStatuses: ActivationStatus[] = [
  "SIMULATED",
  "BLOCKED_LIVE_GATE",
  "COMPLETED",
  "FAILED",
];

export const activationStatusDetails: Record<
  ActivationStatus,
  {
    label: string;
    tone: "good" | "warn" | "bad" | "neutral";
    summary: string;
    step: string;
  }
> = {
  PREPARED: {
    label: "Prepared",
    tone: "neutral",
    summary: "Activation record exists and is waiting for the next trusted step.",
    step: "Activation prepared",
  },
  SIMULATED: {
    label: "Simulated",
    tone: "good",
    summary: "Simulation activation completed without blockchain execution.",
    step: "Simulation complete",
  },
  BLOCKED_LIVE_GATE: {
    label: "Blocked Live Gate",
    tone: "warn",
    summary: "Live testnet execution is prepared, but the runtime write gate is closed.",
    step: "Live gate blocked",
  },
  CHAIN_FUNDED: {
    label: "Chain Funded",
    tone: "warn",
    summary: "A trusted live flow reported funding progress.",
    step: "Funding recorded",
  },
  CHAIN_SUBMITTED: {
    label: "Chain Submitted",
    tone: "warn",
    summary: "A trusted live flow reported chain submission progress.",
    step: "Submitted on chain",
  },
  COMPLETED: {
    label: "Completed",
    tone: "good",
    summary: "Activation completed. Outcome Receipt rendering belongs to the next milestone.",
    step: "Completed",
  },
  FAILED: {
    label: "Failed",
    tone: "bad",
    summary: "Activation failed. This is an execution state, not a measured negative outcome.",
    step: "Failed",
  },
};

export function isTerminalActivationStatus(status: ActivationStatus) {
  return terminalActivationStatuses.includes(status);
}
