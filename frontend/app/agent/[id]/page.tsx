import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, BadgeCheck, Cpu, FileSignature, KeyRound, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { TaskConfigurator } from "@/components/tasks/TaskConfigurator";
import { StatusPill } from "@/components/ui/StatusPill";
import { getProductBootstrap } from "@/lib/api/bootstrap";
import { categorySlugFor, demoTaskForCategory, findAgent } from "@/lib/api/catalog";
import { compactAddress, labelize } from "@/lib/utils/format";

type AgentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AgentPage({ params }: AgentPageProps) {
  const { id } = await params;
  const bootstrap = await getProductBootstrap();

  if (bootstrap.status === "unavailable") {
    return (
      <BackendUnavailableState
        title="Backend unavailable"
        copy={`Spondee could not load /v1/product/bootstrap from ${bootstrap.backendBaseUrl}.`}
        detail={bootstrap.message}
      />
    );
  }

  if (bootstrap.status === "malformed") {
    return (
      <MalformedState
        title="Unexpected bootstrap response"
        copy={`The backend responded from ${bootstrap.backendBaseUrl}, but the response did not match spondee.frontend-bootstrap.v1.`}
        detail={bootstrap.message}
      />
    );
  }

  const agent = findAgent(bootstrap.data, id);
  if (!agent) {
    return <AgentMissing id={id} />;
  }

  const calibration = bootstrap.data.evidence.calibration_by_agent[agent.agent_id];
  const demoTask = demoTaskForCategory(bootstrap.data, agent.category);
  const canPreviewPromise = agent.identity.source === "SPONDEE" && Boolean(demoTask);

  return (
    <>
      <TopNav bootstrap={bootstrap.data} />
      <main className="detail-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href={`/category/${categorySlugFor(agent.category)}`}>
            <ArrowLeft aria-hidden="true" size={16} />
            {agent.category}
          </Link>
        </nav>

        <section className="detail-hero agent-detail-hero">
          <div>
            <p className="eyebrow">{agent.category}</p>
            <h1>{agent.name}</h1>
            <p>{agent.description}</p>
          </div>
          <div className="detail-status-stack">
            <StatusPill tone={agent.activatable ? "good" : "warn"}>
              {agent.activatable ? "Activation compatible" : "Discovery only"}
            </StatusPill>
            <StatusPill tone={agent.identity.source === "SPONDEE" ? "good" : "neutral"}>
              {agent.identity.source}
            </StatusPill>
          </div>
        </section>

        <section className="agent-detail-grid">
          <DetailPanel title="Identity" icon={KeyRound}>
            <Fact label="Registry Agent ID" value={agent.identity.registry_agent_id ?? "Unavailable"} />
            <Fact label="Provider Address" value={compactAddress(agent.identity.provider_address) ?? "Unavailable"} />
            <Fact label="Identity URL" value={agent.identity.identity_url ?? "Unavailable"} />
          </DetailPanel>
          <DetailPanel title="Runtime" icon={Cpu}>
            <Fact label="Readiness" value={labelize(agent.readiness)} />
            <Fact label="Network" value={agent.identity.network} />
            <Fact label="Version" value={agent.version} />
          </DetailPanel>
          <DetailPanel title="Activation Compatibility" icon={ShieldCheck}>
            <Fact label="Proof Status" value={labelize(agent.activation_proof.status)} />
            <Fact label="Verified Job" value={agent.activation_proof.job_id ?? "Unavailable"} />
            <Fact label="Evidence Ref" value={agent.activation_proof.evidence_ref ?? "Unavailable"} />
          </DetailPanel>
          <DetailPanel title="Evidence Availability" icon={BadgeCheck}>
            <Fact label="Observed Runs" value={String(calibration?.observed_run_count ?? 0)} />
            <Fact label="Scored Calibration" value={String(calibration?.scored_calibration_count ?? 0)} />
            <Fact label="Calibration Status" value={calibration ? labelize(calibration.status) : "Unavailable"} />
          </DetailPanel>
        </section>

        <section className="capability-panel">
          <div>
            <p className="eyebrow">Capability Surface</p>
            <h2>Declared task capabilities</h2>
          </div>
          <div className="capability-row">
            {agent.capabilities.map((capability) => (
              <span key={capability}>{labelize(capability)}</span>
            ))}
          </div>
        </section>

        <section className="content-section detail-section configure-section">
          {canPreviewPromise && demoTask ? (
            <TaskConfigurator
              initialTask={demoTask}
              agent={agent}
              liveTestnetReady={bootstrap.data.runtime.live_testnet_write_ready}
            />
          ) : (
            <div className="empty-state">
              <FileSignature aria-hidden="true" size={22} />
              Promise preview is available only for Spondee-controlled agents with a backend-provided demo task.
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function DetailPanel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="detail-panel">
      <h2>
        <Icon aria-hidden="true" size={19} />
        {title}
      </h2>
      <dl>{children}</dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function AgentMissing({ id }: { id: string }) {
  return (
    <main className="state-screen">
      <h1>Agent not found</h1>
      <p>No agent matching &quot;{id}&quot; was returned by the current product bootstrap.</p>
      <Link className="button-secondary" href="/">
        Return to marketplace
      </Link>
    </main>
  );
}
