import { ArrowDown, BadgeCheck, FileSearch, ReceiptText, ShieldCheck, TimerReset } from "lucide-react";
import Link from "next/link";
import type { BootstrapResponse } from "@/lib/api/types";
import { CANONICAL_EVIDENCE_SUMMARY } from "@/lib/canonical-evidence";
import { StatusPill } from "@/components/ui/StatusPill";

type HeroProps = {
  bootstrap: BootstrapResponse;
};

export function Hero({ bootstrap }: HeroProps) {
  const runtimeReport = bootstrap.evidence.agent_advantage_report;

  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow">Measured agent marketplace</p>
        <h1>Agents, measured by what they deliver.</h1>
        <p className="hero-lede">
          Pick a financial agent by the task-specific promise it makes before activation, then inspect
          the receipt, replay and baseline evidence after the run.
        </p>
        <div className="hero-actions">
          <a className="button-primary" href="#marketplace">
            Explore marketplace
            <ArrowDown aria-hidden="true" size={18} />
          </a>
          <Link className="button-secondary" href="/evidence">
            View evidence
            <FileSearch aria-hidden="true" size={18} />
          </Link>
        </div>
      </div>

      <div className="hero-panel" aria-label="Verified product evidence">
        <div>
          <BadgeCheck aria-hidden="true" size={20} />
          <span>Canonical observed evidence</span>
          <strong>
            {CANONICAL_EVIDENCE_SUMMARY.countable_pairs} / {CANONICAL_EVIDENCE_SUMMARY.required_pairs} verified pairs
          </strong>
          <StatusPill tone="good">{CANONICAL_EVIDENCE_SUMMARY.status}</StatusPill>
        </div>
        <div>
          <TimerReset aria-hidden="true" size={20} />
          <span>Current runtime store</span>
          <strong>{runtimeReport.paired_run_count} paired runs loaded</strong>
        </div>
        <div>
          <ReceiptText aria-hidden="true" size={20} />
          <span>Frontend contract</span>
          <strong>{bootstrap.schema}</strong>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" size={20} />
          <span>Truth boundary</span>
          <strong>Canonical proof and runtime state stay separate</strong>
        </div>
      </div>
    </section>
  );
}
