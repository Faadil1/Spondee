import { BadgeCheck, Boxes, FileClock, ShieldCheck } from "lucide-react";
import type { BootstrapResponse } from "@/lib/api/types";
import { CANONICAL_EVIDENCE_SUMMARY } from "@/lib/canonical-evidence";
import { StatusPill } from "@/components/ui/StatusPill";

type ProofStripProps = {
  bootstrap: BootstrapResponse;
};

export function ProofStrip({ bootstrap }: ProofStripProps) {
  const categoryCount = bootstrap.categories.length;

  return (
    <section className="proof-strip" aria-label="Verified Spondee product proof">
      <div>
        <Boxes aria-hidden="true" size={20} />
        <span>{categoryCount}/4 bounded agent task paths</span>
      </div>
      <div>
        <ShieldCheck aria-hidden="true" size={20} />
        <span>4/4 BSC-testnet activation paths verified</span>
      </div>
      <div>
        <FileClock aria-hidden="true" size={20} />
        <span>{CANONICAL_EVIDENCE_SUMMARY.countable_pairs}/3 countable observed pairs preserved</span>
      </div>
      <div>
        <BadgeCheck aria-hidden="true" size={20} />
        <StatusPill tone="good">ERC-8183 bounded activation</StatusPill>
      </div>
    </section>
  );
}
