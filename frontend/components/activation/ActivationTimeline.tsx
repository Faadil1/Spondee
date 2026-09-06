import { CheckCircle2, Circle, CircleDot, OctagonAlert } from "lucide-react";
import type { ActivationRecord, ActivationStatus } from "@/lib/api/types";
import { activationStatusDetails } from "./status";

const statusOrder: ActivationStatus[] = [
  "PREPARED",
  "SIMULATED",
  "BLOCKED_LIVE_GATE",
  "CHAIN_FUNDED",
  "CHAIN_SUBMITTED",
  "COMPLETED",
  "FAILED",
];

export function ActivationTimeline({ activation }: { activation: ActivationRecord }) {
  const visibleStatuses = statusOrder.filter((status) => shouldShowStatus(status, activation));

  return (
    <ol className="activation-timeline" aria-label="Activation progress">
      <li className="timeline-item timeline-done">
        <CheckCircle2 aria-hidden="true" size={18} />
        <div>
          <strong>Promise confirmed</strong>
          <span>{activation.promise_id}</span>
        </div>
      </li>
      {visibleStatuses.map((status) => {
        const detail = activationStatusDetails[status];
        const current = activation.status === status;
        const Icon = status === "FAILED" ? OctagonAlert : current ? CircleDot : Circle;
        return (
          <li className={`timeline-item ${current ? "timeline-current" : ""}`} key={status}>
            <Icon aria-hidden="true" size={18} />
            <div>
              <strong>{detail.step}</strong>
              <span>{current ? detail.summary : detail.label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function shouldShowStatus(status: ActivationStatus, activation: ActivationRecord) {
  if (status === activation.status) return true;
  if (activation.mode === "SIMULATION") return status === "PREPARED" || status === "SIMULATED";
  if (activation.status === "BLOCKED_LIVE_GATE") return status === "PREPARED" || status === "BLOCKED_LIVE_GATE";
  if (activation.status === "FAILED") return status === "PREPARED" || status === "FAILED";
  if (status === "PREPARED") return true;
  if (status === "CHAIN_FUNDED") return ["CHAIN_FUNDED", "CHAIN_SUBMITTED", "COMPLETED"].includes(activation.status);
  if (status === "CHAIN_SUBMITTED") return ["CHAIN_SUBMITTED", "COMPLETED"].includes(activation.status);
  if (status === "COMPLETED") return activation.status === "COMPLETED";
  return false;
}
