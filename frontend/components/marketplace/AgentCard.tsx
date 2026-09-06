import { ExternalLink, KeyRound, Radio, Shield } from "lucide-react";
import Link from "next/link";
import type { AgentRecord, CalibrationSummary } from "@/lib/api/types";
import { compactAddress, labelize } from "@/lib/utils/format";
import { StatusPill } from "@/components/ui/StatusPill";

type AgentCardProps = {
  agent: AgentRecord;
  calibration?: CalibrationSummary;
  compact?: boolean;
};

export function AgentCard({ agent, calibration, compact = false }: AgentCardProps) {
  return (
    <article className={`agent-card ${compact ? "agent-card-compact" : ""}`}>
      <div className="agent-card-header">
        <div>
          <p className="eyebrow">{agent.category}</p>
          <h3>{agent.name}</h3>
        </div>
        <StatusPill tone={agent.activatable ? "good" : "warn"}>
          {agent.activatable ? "Controlled" : "Discovery"}
        </StatusPill>
      </div>

      <p>{agent.description}</p>

      <div className="agent-meta">
        <span>
          <Radio aria-hidden="true" size={15} />
          {agent.identity.network}
        </span>
        <span>
          <Shield aria-hidden="true" size={15} />
          {agent.activation_proof.status}
        </span>
        {agent.identity.provider_address ? (
          <span>
            <KeyRound aria-hidden="true" size={15} />
            {compactAddress(agent.identity.provider_address)}
          </span>
        ) : null}
      </div>

      <div className="capability-row" aria-label={`${agent.name} capabilities`}>
        {agent.capabilities.slice(0, 4).map((capability) => (
          <span key={capability}>{labelize(capability)}</span>
        ))}
      </div>

      <dl className="agent-facts">
        <div>
          <dt>Identity source</dt>
          <dd>{agent.identity.source}</dd>
        </div>
        <div>
          <dt>Version</dt>
          <dd>{agent.version}</dd>
        </div>
        {agent.activation_proof.job_id ? (
          <div>
            <dt>Verified job</dt>
            <dd>{agent.activation_proof.job_id}</dd>
          </div>
        ) : null}
        {calibration ? (
          <div>
            <dt>Calibration</dt>
            <dd>{calibration.status}</dd>
          </div>
        ) : null}
      </dl>

      <div className="agent-card-actions">
        <Link className="text-link" href={`/agent/${agent.agent_id}`}>
          Open agent
        </Link>
        {agent.identity.identity_url ? (
          <a className="text-link" href={agent.identity.identity_url}>
            Registry identity
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : null}
      </div>
    </article>
  );
}
