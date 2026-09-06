"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Clock3, FileSignature, Radio, ShieldCheck } from "lucide-react";
import type { ActivationRecord } from "@/lib/api/types";
import { getActivation } from "@/lib/api/activations";
import { formatTimestamp, labelize } from "@/lib/utils/format";
import { PromiseCard } from "@/components/promise/PromiseCard";
import { ActivationStatusPill } from "./ActivationStatusPill";
import { ActivationTimeline } from "./ActivationTimeline";
import { activationStatusDetails, isTerminalActivationStatus } from "./status";

type ActivationProgressClientProps = {
  initialActivation: ActivationRecord;
};

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 60;

export function ActivationProgressClient({ initialActivation }: ActivationProgressClientProps) {
  const [activation, setActivation] = useState(initialActivation);
  const [pollError, setPollError] = useState<string | null>(null);
  const pollCount = useRef(0);

  useEffect(() => {
    if (isTerminalActivationStatus(activation.status)) return;
    if (pollCount.current >= MAX_POLLS) {
      setPollError("Polling paused after the bounded active window. Refresh to inspect the latest backend state.");
      return;
    }

    const timer = window.setTimeout(async () => {
      pollCount.current += 1;
      const result = await getActivation(activation.activation_id);
      if (result.status === "success") {
        setActivation(result.activation);
        setPollError(null);
        return;
      }
      setPollError(result.message);
    }, POLL_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [activation.activation_id, activation.status, activation.updated_at]);

  const statusDetail = activationStatusDetails[activation.status];

  return (
    <div className="activation-page-layout">
      <section className="activation-progress-panel">
        <div className="activation-progress-header">
          <div>
            <p className="eyebrow">Activation Progress</p>
            <h1>{statusDetail.label}</h1>
            <p>{statusDetail.summary}</p>
          </div>
          <ActivationStatusPill status={activation.status} />
        </div>

        <ActivationTimeline activation={activation} />

        {activation.status === "BLOCKED_LIVE_GATE" ? (
          <div className="activation-boundary">
            BLOCKED_LIVE_GATE is a terminal state for this browser journey. It means live execution was not performed because the server runtime write gate is closed.
          </div>
        ) : null}

        {activation.status === "FAILED" && activation.failure_reason ? (
          <div className="activation-failure">
            <AlertTriangle aria-hidden="true" size={20} />
            <span>{activation.failure_reason}</span>
          </div>
        ) : null}

        {pollError ? (
          <div className="activation-failure">
            <AlertTriangle aria-hidden="true" size={20} />
            <span>{pollError}</span>
          </div>
        ) : null}
      </section>

      <section className="activation-facts">
        <Fact icon={FileSignature} label="Activation ID" value={activation.activation_id} />
        <Fact icon={Radio} label="Mode" value={activation.mode} />
        <Fact icon={ShieldCheck} label="Network" value={activation.chain.network ?? "Simulation only"} />
        <Fact icon={Clock3} label="Updated" value={formatTimestamp(activation.updated_at)} />
      </section>

      <section className="activation-technical">
        <dl>
          <div>
            <dt>Promise ID</dt>
            <dd>{activation.promise_id}</dd>
          </div>
          <div>
            <dt>Scenario</dt>
            <dd>{activation.scenario_id}</dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd>{activation.agent_id}</dd>
          </div>
          <div>
            <dt>Receipt</dt>
            <dd>
              {activation.receipt_id ? (
                <Link className="text-link" href={`/receipt/${activation.receipt_id}`}>
                  View Outcome Receipt
                </Link>
              ) : activation.status === "BLOCKED_LIVE_GATE" ? (
                "No Outcome Receipt was created because live execution did not occur."
              ) : (
                "No Outcome Receipt returned by activation state."
              )}
            </dd>
          </div>
          <div>
            <dt>Replay</dt>
            <dd>
              <Link className="text-link" href={`/activation/${activation.activation_id}/replay`}>
                View Decision Replay
              </Link>
            </dd>
          </div>
          <div>
            <dt>Job</dt>
            <dd>{activation.chain.job_id ?? "No chain job"}</dd>
          </div>
          <div>
            <dt>Transactions</dt>
            <dd>{activation.chain.tx_hashes.length ? activation.chain.tx_hashes.join(", ") : "No chain transactions"}</dd>
          </div>
        </dl>
        <p>{labelize(activation.status)} is an activation execution state, not observed Agent Advantage evidence.</p>
      </section>

      <PromiseCard promise={activation.promise} />
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="detail-fact">
      <Icon aria-hidden="true" size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
