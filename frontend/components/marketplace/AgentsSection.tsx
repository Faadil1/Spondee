import type { BootstrapResponse } from "@/lib/api/types";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AgentCard } from "./AgentCard";

type AgentsSectionProps = {
  bootstrap: BootstrapResponse;
};

export function AgentsSection({ bootstrap }: AgentsSectionProps) {
  const controlledAgents = bootstrap.agents.filter((agent) => agent.identity.source === "SPONDEE");

  return (
    <section className="content-section" id="agents">
      <SectionHeader
        eyebrow="Controlled agents"
        title="Agents that can enter the Spondee path"
        copy="Only controlled Spondee agents continue into Configure Task. External discovery stays separate until an adapter is independently verified."
      />

      {controlledAgents.length > 0 ? (
        <div className="agent-grid">
          {controlledAgents.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              calibration={bootstrap.evidence.calibration_by_agent[agent.agent_id]}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">The backend returned no controlled Spondee agents.</div>
      )}
    </section>
  );
}
