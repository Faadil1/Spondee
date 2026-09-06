import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { AgentsSection } from "@/components/marketplace/AgentsSection";
import { CategoryGrid } from "@/components/marketplace/CategoryGrid";
import { EvidenceTeaser } from "@/components/marketplace/EvidenceTeaser";
import { Hero } from "@/components/marketplace/Hero";
import { Mechanism } from "@/components/marketplace/Mechanism";
import { ProofStrip } from "@/components/marketplace/ProofStrip";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { getProductBootstrap } from "@/lib/api/bootstrap";

export default async function Home() {
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

  return (
    <>
      <TopNav bootstrap={bootstrap.data} />
      <main>
        <Hero bootstrap={bootstrap.data} />
        <ProofStrip bootstrap={bootstrap.data} />
        <CategoryGrid bootstrap={bootstrap.data} />
        <AgentsSection bootstrap={bootstrap.data} />
        <Mechanism />
        <EvidenceTeaser bootstrap={bootstrap.data} />
      </main>
      <Footer />
    </>
  );
}
