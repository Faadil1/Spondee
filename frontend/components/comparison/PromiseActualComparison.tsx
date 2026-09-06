import type { LucideIcon } from "lucide-react";
import { BadgeCheck, CircleSlash, Clock3, DollarSign, ShieldAlert } from "lucide-react";
import type { ActivationRecord, OutcomeReceipt, PromiseCard } from "@/lib/api/types";
import { labelize, stringifyMetric } from "@/lib/utils/format";

type PromiseActualComparisonProps = {
  receipt: OutcomeReceipt;
  activation: ActivationRecord | null;
  activationLookupMessage?: string;
};

export function PromiseActualComparison({
  receipt,
  activation,
  activationLookupMessage,
}: PromiseActualComparisonProps) {
  const promise = activation?.promise ?? null;

  return (
    <section className="comparison-panel" aria-labelledby="promise-vs-actual">
      <div className="receipt-section-heading">
        <p className="eyebrow">Promise vs Actual</p>
        <h2 id="promise-vs-actual">Promise compared with the receipt</h2>
      </div>

      {promise ? (
        <div className="comparison-grid">
          <ComparisonRow
            icon={BadgeCheck}
            label="Outcome"
            promised={promise.expected_outcome}
            actual={stringifyMetric(receipt.actual_outcome)}
          />
          <ComparisonRow
            icon={DollarSign}
            label="Cost"
            promised={`${promise.expected_cost.amount} ${promise.expected_cost.currency}`}
            actual={`${receipt.actual_cost.amount} ${receipt.actual_cost.currency}`}
          />
          <MetricGroup
            icon={Clock3}
            label="Timing"
            promised={promise.timing}
            actual={receipt.actual_outcome}
          />
          <MetricGroup
            icon={ShieldAlert}
            label="Downside / Risk"
            promised={promise.expected_downside}
            actual={receipt.actual_outcome}
          />
          <ComparisonRow
            icon={CircleSlash}
            label="Calibration"
            promised={labelize(promise.confidence_status)}
            actual={`${labelize(receipt.calibration.status)}; eligible for observed Agent Advantage: ${String(
              receipt.calibration.eligible_for_observed_agent_advantage,
            )}`}
          />
        </div>
      ) : (
        <div className="comparison-missing">
          <CircleSlash aria-hidden="true" size={20} />
          <p>
            Promise reference not available from current backend activation state. The receipt loaded by ID, but the
            comparison cannot reconstruct promised fields.
          </p>
          {activationLookupMessage ? <span>{activationLookupMessage}</span> : null}
        </div>
      )}
    </section>
  );
}

function ComparisonRow({
  icon: Icon,
  label,
  promised,
  actual,
}: {
  icon: LucideIcon;
  label: string;
  promised: string;
  actual: string;
}) {
  return (
    <article className="comparison-row">
      <h3>
        <Icon aria-hidden="true" size={18} />
        {label}
      </h3>
      <div>
        <span>Promised</span>
        <strong>{promised}</strong>
      </div>
      <div>
        <span>Actual</span>
        <strong>{actual}</strong>
      </div>
    </article>
  );
}

function MetricGroup({
  icon: Icon,
  label,
  promised,
  actual,
}: {
  icon: LucideIcon;
  label: string;
  promised: PromiseCard["timing"];
  actual: OutcomeReceipt["actual_outcome"];
}) {
  const rows = Object.entries(promised);

  return (
    <article className="comparison-row comparison-row-wide">
      <h3>
        <Icon aria-hidden="true" size={18} />
        {label}
      </h3>
      {rows.length ? (
        <dl className="comparison-metric-list">
          {rows.map(([key, value]) => {
            const actualKey = findActualMetricKey(key, actual);
            const actualValue = actualKey ? stringifyMetric(actual[actualKey]) : "Not measured in this run.";
            return (
              <div key={key}>
                <dt>{labelize(key)}</dt>
                <dd>
                  <span>
                    <span className="comparison-value-label">Promised</span>
                    {stringifyMetric(value)}
                  </span>
                  <strong>
                    <span className="comparison-value-label">Actual</span>
                    {actualValue}
                  </strong>
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p>Not measured in this run.</p>
      )}
    </article>
  );
}

function findActualMetricKey(key: string, actual: OutcomeReceipt["actual_outcome"]) {
  if (Object.hasOwn(actual, key)) return key;

  const compatibleKeyByPromiseKey: Record<string, string> = {
    breach_projected: "floor_crossed",
    minimum_projected_hf: "minimum_hf",
    predicted_floor_crossing_seconds: "floor_crossing_seconds",
    expected_warning_issued_seconds: "warning_issued_seconds",
    expected_warning_lead_seconds: "useful_lead_seconds",
    out_of_range_projected: "projected_out_of_range",
  };
  const compatibleKey = compatibleKeyByPromiseKey[key];

  return compatibleKey && Object.hasOwn(actual, compatibleKey) ? compatibleKey : null;
}
