import { BadgeCheck, MinusCircle, TimerReset, TrendingDown } from "lucide-react";
import { CANONICAL_EVIDENCE_SUMMARY } from "@/lib/canonical-evidence";
import { StatusPill } from "@/components/ui/StatusPill";

export function CanonicalEvidencePanel() {
  return (
    <section className="receipt-panel" aria-labelledby="canonical-evidence-heading">
      <div className="receipt-section-heading">
        <p className="eyebrow">Canonical preserved evidence</p>
        <h2 id="canonical-evidence-heading">Three verified observed pairs, preserved before deployment</h2>
        <p>
          This record is separate from the current runtime database. A fresh runtime may start empty; that does not erase
          the repository-preserved evidence already verified for jobs 962, 971 and 973.
        </p>
      </div>

      <div className="receipt-facts" aria-label="Canonical evidence summary">
        <Fact icon={BadgeCheck} label="Countable pairs" value="3 / 3" />
        <Fact icon={TrendingDown} label="Trading pair" value="Grid 962" />
        <Fact icon={TimerReset} label="Health warning lead" value="95.829 s" />
        <Fact icon={MinusCircle} label="Neutral evidence" value="Rebalancing 973" />
      </div>

      <div className="evidence-run-grid">
        {CANONICAL_EVIDENCE_SUMMARY.pairs.map((pair) => (
          <article className="evidence-run-card" key={pair.pair_id}>
            <div className="evidence-run-card-top">
              <h3>{pair.category}</h3>
              <StatusPill tone={pair.outcome === "TIMING_ADVANTAGE_WITH_LIMITATION" ? "good" : "warn"}>
                {pair.outcome === "NEGATIVE" ? "NEGATIVE" : pair.outcome === "NEUTRAL" ? "NEUTRAL" : "OBSERVED"}
              </StatusPill>
            </div>
            <dl>
              <div>
                <dt>Job</dt>
                <dd>{pair.job_id}</dd>
              </div>
              <div>
                <dt>Pair</dt>
                <dd>{pair.pair_id}</dd>
              </div>
              <div>
                <dt>Measured result</dt>
                <dd>{pair.headline}</dd>
              </div>
            </dl>
            <p>{pair.detail}</p>
            <p className="empty-state">Limitation: {pair.limitation}</p>
          </article>
        ))}
      </div>

      <p className="empty-state">{CANONICAL_EVIDENCE_SUMMARY.claim_guardrail}</p>
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BadgeCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="detail-fact">
      <Icon aria-hidden="true" size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
