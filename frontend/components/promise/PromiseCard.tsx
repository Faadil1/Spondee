import { BadgeCheck, Clock3, FileSignature, ShieldAlert, WalletCards } from "lucide-react";
import type { AgentRecord, PromiseCard as PromiseCardType } from "@/lib/api/types";
import { formatTimestamp, labelize, stringifyMetric } from "@/lib/utils/format";
import { StatusPill } from "@/components/ui/StatusPill";

type PromiseCardProps = {
  promise: PromiseCardType;
  agent?: AgentRecord;
};

export function PromiseCard({ promise, agent }: PromiseCardProps) {
  return (
    <article className="promise-card" aria-label="Promise Card">
      <div className="promise-card-top">
        <div>
          <p className="eyebrow">Promise Card</p>
          <h2>Recorded before activation</h2>
        </div>
        <StatusPill tone="warn">{promise.evidence_class}</StatusPill>
      </div>

      <div className="promise-outcome">
        <FileSignature aria-hidden="true" size={28} />
        <p>{promise.expected_outcome}</p>
      </div>

      <dl className="promise-grid">
        <div>
          <dt>Agent</dt>
          <dd>{agent?.name ?? promise.agent_id}</dd>
        </div>
        <div>
          <dt>Task</dt>
          <dd>{promise.category}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{promise.confidence === null ? labelize(promise.confidence_status) : promise.confidence}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>
            {promise.expected_cost.amount} {promise.expected_cost.currency}
          </dd>
        </div>
      </dl>

      <div className="promise-sections">
        <MetricPanel icon={ShieldAlert} title="Downside / Risk" metrics={promise.expected_downside} />
        <MetricPanel icon={Clock3} title="Timing" metrics={promise.timing} />
        <MetricPanel icon={BadgeCheck} title="Methodology" metrics={promise.methodology} />
      </div>

      <dl className="promise-footer-grid">
        <div>
          <dt>Promise ID</dt>
          <dd>{promise.promise_id}</dd>
        </div>
        <div>
          <dt>Scenario</dt>
          <dd>{promise.scenario_id}</dd>
        </div>
        <div>
          <dt>Network boundary</dt>
          <dd>{agent?.identity.network ?? "Backend selected"}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatTimestamp(promise.created_at)}</dd>
        </div>
      </dl>

      <div className="promise-guardrail">
        <WalletCards aria-hidden="true" size={18} />
        <span>{promise.claim_guardrail}</span>
      </div>
    </article>
  );
}

type MetricPanelProps = {
  icon: typeof ShieldAlert;
  title: string;
  metrics: Record<string, unknown>;
};

function MetricPanel({ icon: Icon, title, metrics }: MetricPanelProps) {
  const entries = Object.entries(metrics);

  return (
    <section>
      <h3>
        <Icon aria-hidden="true" size={18} />
        {title}
      </h3>
      {entries.length ? (
        <dl>
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt>{labelize(key)}</dt>
              <dd>{stringifyMetric(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>No backend fields returned.</p>
      )}
    </section>
  );
}
