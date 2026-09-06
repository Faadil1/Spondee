import type { ActivationStatus } from "@/lib/api/types";
import { StatusPill } from "@/components/ui/StatusPill";
import { activationStatusDetails } from "./status";

export function ActivationStatusPill({ status }: { status: ActivationStatus }) {
  const detail = activationStatusDetails[status];
  return <StatusPill tone={detail.tone}>{detail.label}</StatusPill>;
}
