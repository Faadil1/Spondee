import { FileSearch, MinusCircle, TrendingDown, Timer } from "lucide-react";
import Link from "next/link";
import type { BootstrapResponse } from "@/lib/api/types";
import { stringifyMetric } from "@/lib/utils/format";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";

type EvidenceTeaserProps = {
  bootstrap: BootstrapResponse;
};

export function EvidenceTeaser({ bootstrap }: EvidenceTeaserProps) {
  const report = bootstrap.evidence.agent_advantage_report;
  const pairTone = report.status === "READY" ? "good" : "warn";

  return (
    <section className="content-section" id="evidence">
      <SectionHeader
        eyebrow="Evidence"
        title="Negative and neutral outcomes stay visible"
        copy="Agent Advantage is computed from runtime evidence only. Simulation runs, repository summaries and registry identity never become observed performance by presentation."
      />

      <div className="evidence-layout">
        <article className="evidence-summary">
          <FileSearch aria-hidden="true" size={28} />
          <div>
            <span>Agent Advantage</span>
            <strong>{report.paired_run_count} paired observed runs</strong>
            <StatusPill tone={pairTone}>{report.status}</StatusPill>
          </div>
          <Link className="text-link" href="/evidence">
            Open evidence
          </Link>
        </article>

        <div className="evidence-metrics">
          <div>
            <Timer aria-hidden="true" size={20} />
            <span>Observed runs</span>
            <strong>{report.observed_run_count}</strong>
          </div>
          <div>
            <MinusCircle aria-hidden="true" size={20} />
            <span>Simulation excluded</span>
            <strong>{report.excluded_simulation_count}</strong>
          </div>
          <div>
            <TrendingDown aria-hidden="true" size={20} />
            <span>Latest delta sample</span>
            <strong>{stringifyMetric(report.pairs[0]?.advantage_delta)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
