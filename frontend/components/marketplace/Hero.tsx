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
        <p className="eyebrow">BNB Chain agent outcome marketplace</p>
        <h1>Agents, measured by what they deliver.</h1>
        <p className="hero-lede">
          Make the agent commit to a task-specific Promise before bounded activation, then inspect the Outcome Receipt
          and compare measured evidence against a without-agent baseline.
        </p>
        <div className="hero-actions">
          <Link className="button-primary" href="/category/health-factor">
            Start Health Factor path
            <ArrowDown aria-hidden="true" size={18} />
          </Link>
          <a className="button-secondary" href="#marketplace">
            Explore marketplace
          </a>
          <Link className="button-secondary" href="/evidence">
            Inspect 3/3 evidence
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
          <span>Authority model</span>
          <strong>ERC-8183 bounded BSC-testnet activation</strong>
        </div>
      </div>
    </section>
  );
}
