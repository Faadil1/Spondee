import { Activity, ArrowDownRight } from "lucide-react";
import Link from "next/link";
import type { BootstrapResponse } from "@/lib/api/types";
import { StatusPill } from "@/components/ui/StatusPill";

type TopNavProps = {
  bootstrap: BootstrapResponse;
};

export function TopNav({ bootstrap }: TopNavProps) {
  const liveReady = bootstrap.runtime.live_testnet_write_ready;

  return (
    <header className="top-nav">
      <Link className="brand" href="/" aria-label="Spondee home">
        <span className="brand-mark">S</span>
        <span>Spondee</span>
      </Link>

      <nav aria-label="Primary navigation">
        <Link href="/#marketplace">Marketplace</Link>
        <Link href="/#agents">Agents</Link>
        <Link href="/evidence">Evidence</Link>
      </nav>

      <div className="nav-status" aria-label="Runtime status">
        <StatusPill tone={liveReady ? "good" : "warn"}>
          {liveReady ? "Live-testnet ready" : "Live writes gated"}
        </StatusPill>
        <Link className="icon-link" href="/#mechanism" aria-label="View Spondee mechanism">
          <Activity size={16} />
          <ArrowDownRight size={14} />
        </Link>
      </div>
    </header>
  );
}
