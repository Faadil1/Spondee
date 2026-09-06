import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { EvidenceRunDetail } from "@/components/evidence/EvidenceDashboard";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { getProductBootstrap } from "@/lib/api/bootstrap";
import { getEvidenceRun } from "@/lib/api/evidence";

type EvidenceRunPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EvidenceRunPage({ params }: EvidenceRunPageProps) {
  const { id } = await params;
  const [bootstrap, result] = await Promise.all([getProductBootstrap(), getEvidenceRun(id)]);

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

  if (result.status === "unavailable") {
    return (
      <BackendUnavailableState
        title="Evidence API unavailable"
        copy="Spondee could not load this evidence run from the backend."
        detail={result.message}
      />
    );
  }

  if (result.status === "malformed") {
    return (
      <MalformedState
        title="Malformed evidence response"
        copy="The backend responded, but the evidence run payload was not compatible with the frontend contract."
        detail={result.message}
      />
    );
  }

  if (result.status === "not_found") {
    return <EvidenceRunMissing id={id} />;
  }

  if (result.status === "server_error") {
    return (
      <BackendUnavailableState
        title="Evidence fetch failed"
        copy="The backend could not return this evidence run."
        detail={result.message}
      />
    );
  }

  return (
    <>
      <TopNav bootstrap={bootstrap.data} />
      <main className="detail-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/evidence">
            <ArrowLeft aria-hidden="true" size={16} />
            Evidence
          </Link>
        </nav>
        <EvidenceRunDetail run={result.evidence} />
      </main>
      <Footer />
    </>
  );
}

function EvidenceRunMissing({ id }: { id: string }) {
  return (
    <main className="state-screen">
      <h1>Evidence run not found</h1>
      <p>No evidence run matching &quot;{id}&quot; was returned by the backend.</p>
      <Link className="button-secondary" href="/evidence">
        Return to evidence
      </Link>
    </main>
  );
}
