import { ArrowDown, FileSearch, ReceiptText, ShieldCheck, TimerReset } from "lucide-react";
import Link from "next/link";
import type { BootstrapResponse } from "@/lib/api/types";
import { StatusPill } from "@/components/ui/StatusPill";

type HeroProps = {
  bootstrap: BootstrapResponse;
};

export function Hero({ bootstrap }: HeroProps) {
  const report = bootstrap.evidence.agent_advantage_report;

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

      <div className="hero-panel" aria-label="Live product state">
        <div>
          <TimerReset aria-hidden="true" size={20} />
          <span>Runtime evidence</span>
          <strong>{report.paired_run_count} paired observed runs</strong>
        </div>
        <div>
          <ReceiptText aria-hidden="true" size={20} />
          <span>Contract</span>
          <strong>{bootstrap.schema}</strong>
        </div>
        <div>
          <ShieldCheck aria-hidden="true" size={20} />
          <span>Evidence status</span>
          <StatusPill tone={report.status === "READY" ? "good" : "warn"}>{report.status}</StatusPill>
        </div>
      </div>
    </section>
  );
}
