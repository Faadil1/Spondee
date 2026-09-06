import { Activity, ArrowDownRight } from "lucide-react";
import Link from "next/link";

type SimpleNavProps = {
  statusLabel?: string;
};

export function SimpleNav({ statusLabel = "Proof surface" }: SimpleNavProps) {
  return (
    <header className="top-nav simple-nav">
      <Link className="brand" href="/" aria-label="Spondee home">
        <span className="brand-mark">S</span>
        <span>Spondee</span>
      </Link>

      <nav aria-label="Primary navigation">
        <Link href="/#marketplace">Marketplace</Link>
        <Link href="/#agents">Agents</Link>
        <Link href="/evidence">Evidence</Link>
      </nav>

      <div className="nav-status" aria-label="Page status">
        <span className="status-pill status-pill-neutral">{statusLabel}</span>
        <Link className="icon-link" href="/#mechanism" aria-label="View Spondee mechanism">
          <Activity size={16} aria-hidden="true" />
          <ArrowDownRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
