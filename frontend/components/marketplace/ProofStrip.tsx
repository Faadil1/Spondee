import { BadgeCheck, Boxes, FileClock, ShieldCheck } from "lucide-react";
import type { BootstrapResponse } from "@/lib/api/types";
import { StatusPill } from "@/components/ui/StatusPill";

type ProofStripProps = {
  bootstrap: BootstrapResponse;
};

export function ProofStrip({ bootstrap }: ProofStripProps) {
  const report = bootstrap.evidence.agent_advantage_report;
  const categoryCount = bootstrap.categories.length;

  return (
    <section className="proof-strip" aria-label="Product proof from bootstrap">
      <div>
        <Boxes aria-hidden="true" size={20} />
        <span>{categoryCount} bounded task paths</span>
      </div>
      <div>
        <ShieldCheck aria-hidden="true" size={20} />
        <span>{bootstrap.backend_capabilities.live_bsc_testnet_transport_four_categories ?? "Runtime reported"}</span>
      </div>
      <div>
        <FileClock aria-hidden="true" size={20} />
        <span>{report.observed_run_count} runtime observed runs</span>
      </div>
      <div>
        <BadgeCheck aria-hidden="true" size={20} />
        <StatusPill tone={bootstrap.runtime.live_testnet_write_ready ? "good" : "warn"}>
          {bootstrap.runtime.live_testnet_write_ready ? "Write gate ready" : "Write gate closed"}
        </StatusPill>
      </div>
    </section>
  );
}
