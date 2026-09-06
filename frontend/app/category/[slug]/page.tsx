import Link from "next/link";
import { ArrowLeft, BadgeCheck, FileText, Radio, ShieldCheck } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { AgentCard } from "@/components/marketplace/AgentCard";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { StatusPill } from "@/components/ui/StatusPill";
import { getProductBootstrap } from "@/lib/api/bootstrap";
import { controlledAgentsForCategory, findCategoryBySlug } from "@/lib/api/catalog";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
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

  const entry = findCategoryBySlug(bootstrap.data, slug);
  if (!entry) {
    return <CategoryMissing slug={slug} />;
  }

  const agents = controlledAgentsForCategory(bootstrap.data, entry.category);
  const evidence = bootstrap.data.evidence.agent_advantage_report;

  return (
    <>
      <TopNav bootstrap={bootstrap.data} />
      <main className="detail-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Marketplace
          </Link>
        </nav>

        <section className="detail-hero category-detail-hero">
          <div>
            <p className="eyebrow">{entry.presentation.short_label}</p>
            <h1>{entry.category}</h1>
            <p>{entry.presentation.promise_question}</p>
          </div>
          <div className="detail-status-stack">
            <StatusPill tone={entry.reference_agent.activatable ? "good" : "warn"}>
              {entry.reference_agent.activatable ? "Controlled agent available" : "Discovery only"}
            </StatusPill>
            <StatusPill tone={evidence.status === "READY" ? "good" : "warn"}>{evidence.status}</StatusPill>
          </div>
        </section>

        <section className="detail-band">
          <div className="detail-fact">
            <FileText aria-hidden="true" size={20} />
            <span>Receipt focus</span>
            <strong>{entry.presentation.receipt_focus}</strong>
          </div>
          <div className="detail-fact">
            <Radio aria-hidden="true" size={20} />
            <span>Runtime source</span>
            <strong>Live bootstrap API</strong>
          </div>
          <div className="detail-fact">
            <BadgeCheck aria-hidden="true" size={20} />
            <span>Runtime evidence</span>
            <strong>{evidence.paired_run_count} paired / {evidence.observed_run_count} observed</strong>
          </div>
          <div className="detail-fact">
            <ShieldCheck aria-hidden="true" size={20} />
            <span>Countability</span>
            <strong>{bootstrap.data.evidence.countability_rule}</strong>
          </div>
        </section>

        <section className="content-section detail-section">
          <div className="section-header">
            <p className="eyebrow">Controlled Agents</p>
            <h2>Choose an agent</h2>
            <p>Only Spondee-controlled agents can continue into Configure Task and Generate Promise.</p>
          </div>
          {agents.length ? (
            <div className="agent-grid">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.agent_id}
                  agent={agent}
                  calibration={bootstrap.data.evidence.calibration_by_agent[agent.agent_id]}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">No controlled agents are available for this category in the current bootstrap.</div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function CategoryMissing({ slug }: { slug: string }) {
  return (
    <main className="state-screen">
      <h1>Category not found</h1>
      <p>No category matching &quot;{slug}&quot; was returned by the current product bootstrap.</p>
      <Link className="button-secondary" href="/">
        Return to marketplace
      </Link>
    </main>
  );
}
