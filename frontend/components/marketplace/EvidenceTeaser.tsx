import { BadgeCheck, FileSearch, MinusCircle, Radio, Timer } from "lucide-react";
import Link from "next/link";
import type { BootstrapResponse } from "@/lib/api/types";
import { CANONICAL_EVIDENCE_SUMMARY } from "@/lib/canonical-evidence";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { StatusPill } from "@/components/ui/StatusPill";

type EvidenceTeaserProps = {
  bootstrap: BootstrapResponse;
};

export function EvidenceTeaser({ bootstrap }: EvidenceTeaserProps) {
  const runtimeReport = bootstrap.evidence.agent_advantage_report;

  return (
    <section className="content-section" id="evidence">
      <SectionHeader
        eyebrow="Evidence"
        title="Three verified pairs. Negative and neutral outcomes stay visible."
        copy="Spondee separates repository-preserved canonical evidence from whatever evidence is currently loaded in the runtime database. A fresh deployment can start with an empty runtime store without erasing the verified 3/3 record."
      />

      <div className="evidence-layout">
        <article className="evidence-summary">
          <BadgeCheck aria-hidden="true" size={28} />
          <div>
            <span>Canonical Agent Advantage</span>
            <strong>
              {CANONICAL_EVIDENCE_SUMMARY.countable_pairs} / {CANONICAL_EVIDENCE_SUMMARY.required_pairs} countable observed pairs
            </strong>
            <StatusPill tone="good">{CANONICAL_EVIDENCE_SUMMARY.status}</StatusPill>
          </div>
          <Link className="text-link" href="/evidence">
            Inspect all evidence
          </Link>
        </article>

        <div className="evidence-metrics">
          <div>
            <FileSearch aria-hidden="true" size={20} />
            <span>Runtime paired runs loaded</span>
            <strong>{runtimeReport.paired_run_count}</strong>
          </div>
          <div>
            <Timer aria-hidden="true" size={20} />
            <span>Runtime observed runs</span>
            <strong>{runtimeReport.observed_run_count}</strong>
          </div>
          <div>
            <MinusCircle aria-hidden="true" size={20} />
            <span>Runtime simulation excluded</span>
            <strong>{runtimeReport.excluded_simulation_count}</strong>
          </div>
          <div>
            <Radio aria-hidden="true" size={20} />
            <span>Runtime status</span>
            <strong>{runtimeReport.status}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
