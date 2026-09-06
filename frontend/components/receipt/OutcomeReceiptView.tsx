import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { BadgeCheck, FileSignature, ReceiptText, ShieldCheck, WalletCards } from "lucide-react";
import type { ActivationRecord, OutcomeReceipt } from "@/lib/api/types";
import { formatTimestamp, labelize, stringifyMetric } from "@/lib/utils/format";
import { StatusPill } from "@/components/ui/StatusPill";
import { PromiseActualComparison } from "@/components/comparison/PromiseActualComparison";

type OutcomeReceiptViewProps = {
  receipt: OutcomeReceipt;
  activation: ActivationRecord | null;
  activationLookupMessage?: string;
};

export function OutcomeReceiptView({ receipt, activation, activationLookupMessage }: OutcomeReceiptViewProps) {
  return (
    <div className="receipt-page-layout">
      <section className="receipt-hero">
        <div>
          <p className="eyebrow">Outcome Receipt</p>
          <h1>The run has a receipt.</h1>
          <p>
            The receipt records the actual outcome for this activation. Its evidence class remains separate from
            observed Agent Advantage.
          </p>
        </div>
        <StatusPill tone="warn">{receipt.evidence_class}</StatusPill>
      </section>

      <section className="receipt-facts" aria-label="Receipt facts">
        <Fact icon={ReceiptText} label="Receipt ID" value={receipt.receipt_id} />
        <Fact icon={FileSignature} label="Promise ID" value={receipt.promise_id} />
        <Fact icon={BadgeCheck} label="Scenario" value={receipt.scenario_id} />
        <Fact icon={ShieldCheck} label="Recorded" value={formatTimestamp(receipt.created_at)} />
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Actual Outcome</p>
          <h2>Measured result fields</h2>
        </div>
        <MetricList metrics={receipt.actual_outcome} emptyLabel="No actual outcome fields returned." />
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Execution Boundary</p>
          <h2>What this receipt can and cannot prove</h2>
        </div>
        <dl className="receipt-definition-list">
          <div>
            <dt>Category</dt>
            <dd>{receipt.category}</dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd>{receipt.agent_id}</dd>
          </div>
          <div>
            <dt>Actual cost</dt>
            <dd>
              {receipt.actual_cost.amount} {receipt.actual_cost.currency}
            </dd>
          </div>
          <div>
            <dt>Calibration status</dt>
            <dd>{labelize(receipt.calibration.status)}</dd>
          </div>
          <div>
            <dt>Eligible for observed Agent Advantage</dt>
            <dd>{String(receipt.calibration.eligible_for_observed_agent_advantage)}</dd>
          </div>
          <div>
            <dt>Transactions</dt>
            <dd>{receipt.tx_hashes.length ? receipt.tx_hashes.join(", ") : "No chain transaction references returned."}</dd>
          </div>
        </dl>
      </section>

      <PromiseActualComparison
        receipt={receipt}
        activation={activation}
        activationLookupMessage={activationLookupMessage}
      />

      {activation ? (
        <section className="receipt-panel">
          <div className="receipt-section-heading">
            <p className="eyebrow">Replay</p>
            <h2>Reconstruct this activation</h2>
          </div>
          <Link className="text-link" href={`/activation/${activation.activation_id}/replay`}>
            View Decision Replay
          </Link>
        </section>
      ) : null}

      <section className="receipt-guardrail">
        <WalletCards aria-hidden="true" size={18} />
        <span>{receipt.claim_guardrail}</span>
      </section>
    </div>
  );
}

function MetricList({ metrics, emptyLabel }: { metrics: Record<string, unknown>; emptyLabel: string }) {
  const entries = Object.entries(metrics);

  if (!entries.length) {
    return <p className="empty-state">{emptyLabel}</p>;
  }

  return (
    <dl className="receipt-metric-grid">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>{labelize(key)}</dt>
          <dd>{stringifyMetric(value)}</dd>
        </div>
      ))}
    </dl>
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
