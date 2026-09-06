import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CircleSlash, Clock3, FileSignature, History, Radio, ShieldCheck } from "lucide-react";
import type { DecisionReplay } from "@/lib/api/types";
import { formatTimestamp, labelize } from "@/lib/utils/format";
import { PromiseCard } from "@/components/promise/PromiseCard";
import { StatusPill } from "@/components/ui/StatusPill";

type DecisionReplayViewProps = {
  replay: DecisionReplay;
};

export function DecisionReplayView({ replay }: DecisionReplayViewProps) {
  return (
    <div className="replay-page-layout">
      <section className="replay-hero">
        <div>
          <p className="eyebrow">Decision Replay</p>
          <h1>This is a reconstruction of what happened.</h1>
          <p>{replay.claim_guardrail}</p>
        </div>
        <StatusPill tone="neutral">{labelize(replay.replay_mode)}</StatusPill>
      </section>

      <section className="receipt-facts" aria-label="Replay facts">
        <Fact icon={History} label="Activation ID" value={replay.activation_id} />
        <Fact icon={FileSignature} label="Promise ID" value={replay.promise_id} />
        <Fact icon={Radio} label="Mode" value={replay.authority.mode} />
        <Fact icon={ShieldCheck} label="Status" value={labelize(replay.status)} />
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Truth Boundary</p>
          <h2>Replay does not execute</h2>
        </div>
        <dl className="receipt-definition-list">
          <div>
            <dt>Promise evidence class</dt>
            <dd>{replay.truth.promise_evidence_class}</dd>
          </div>
          <div>
            <dt>Receipt evidence class</dt>
            <dd>{replay.truth.receipt_evidence_class ?? "No receipt returned"}</dd>
          </div>
          <div>
            <dt>Observed Agent Advantage eligible</dt>
            <dd>{replay.truth.observed_agent_advantage_eligible === null ? "No receipt returned" : String(replay.truth.observed_agent_advantage_eligible)}</dd>
          </div>
          <div>
            <dt>Chain transport observed</dt>
            <dd>{String(replay.truth.chain_transport_observed)}</dd>
          </div>
          <div>
            <dt>Re-execution performed</dt>
            <dd>{String(replay.truth.reexecution_performed)}</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>{replay.authority.network ?? "Simulation only"}</dd>
          </div>
        </dl>
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Timeline</p>
          <h2>Preserved events</h2>
        </div>
        <ol className="replay-timeline">
          {replay.timeline.map((event, index) => (
            <li key={`${event.type}-${index}`}>
              <Clock3 aria-hidden="true" size={18} />
              <div>
                <strong>{labelize(event.type)}</strong>
                <span>{event.label}</span>
                <small>{event.at ? formatTimestamp(event.at) : "Timestamp not returned"}</small>
                {event.reference ? <code>{event.reference}</code> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Original Task</p>
          <h2>Inputs preserved for replay</h2>
        </div>
        <pre className="json-block">{JSON.stringify(replay.inputs, null, 2)}</pre>
      </section>

      <PromiseCard promise={replay.promise} />

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Authority</p>
          <h2>Mode, network and references</h2>
        </div>
        <dl className="receipt-definition-list">
          <div>
            <dt>Job</dt>
            <dd>{replay.authority.job_id ?? "No chain job"}</dd>
          </div>
          <div>
            <dt>Deliverable</dt>
            <dd>{replay.authority.deliverable_url ?? "No deliverable URL returned"}</dd>
          </div>
          <div>
            <dt>Transactions</dt>
            <dd>
              {replay.authority.transaction_hashes.length
                ? replay.authority.transaction_hashes.join(", ")
                : "No chain transactions"}
            </dd>
          </div>
          <div>
            <dt>Replay source</dt>
            <dd>GET /v1/activations/:id/replay</dd>
          </div>
        </dl>
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Outcome Receipt</p>
          <h2>{replay.outcome ? "Receipt reconstructed" : "No receipt"}</h2>
        </div>
        {replay.outcome ? (
          <>
            <dl className="receipt-definition-list">
              <div>
                <dt>Receipt ID</dt>
                <dd>
                  <Link className="text-link" href={`/receipt/${replay.outcome.receipt_id}`}>
                    {replay.outcome.receipt_id}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Evidence class</dt>
                <dd>{replay.outcome.evidence_class}</dd>
              </div>
              <div>
                <dt>Actual cost</dt>
                <dd>
                  {replay.outcome.actual_cost.amount} {replay.outcome.actual_cost.currency}
                </dd>
              </div>
              <div>
                <dt>Calibration</dt>
                <dd>{labelize(replay.outcome.calibration.status)}</dd>
              </div>
            </dl>
            <pre className="json-block">{JSON.stringify(replay.outcome.actual_outcome, null, 2)}</pre>
          </>
        ) : (
          <div className="comparison-missing">
            <CircleSlash aria-hidden="true" size={20} />
            <p>No Outcome Receipt was returned for this activation replay.</p>
          </div>
        )}
      </section>
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
