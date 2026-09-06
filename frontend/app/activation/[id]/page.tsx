import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { SimpleNav } from "@/components/layout/SimpleNav";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { ActivationProgressClient } from "@/components/activation/ActivationProgressClient";
import { getActivation } from "@/lib/api/activations";

type ActivationPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ActivationPage({ params }: ActivationPageProps) {
  const { id } = await params;
  const result = await getActivation(id);

  if (result.status === "unavailable") {
    return (
      <BackendUnavailableState
        title="Backend unavailable"
        copy="Spondee could not load the activation state from the backend."
        detail={result.message}
      />
    );
  }

  if (result.status === "malformed") {
    return (
      <MalformedState
        title="Malformed activation response"
        copy="The backend responded, but the activation payload was not compatible with the frontend activation contract."
        detail={result.message}
      />
    );
  }

  if (result.status === "not_found") {
    return <ActivationMissing id={id} />;
  }

  if (result.status === "server_error") {
    return (
      <BackendUnavailableState
        title="Activation fetch failed"
        copy="The backend could not return this activation."
        detail={result.message}
      />
    );
  }

  return (
    <>
      <SimpleNav statusLabel={result.activation.status} />
      <main className="detail-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href={`/agent/${result.activation.agent_id}`}>
            <ArrowLeft aria-hidden="true" size={16} />
            {result.activation.agent_id}
          </Link>
        </nav>
        <ActivationProgressClient key={result.activation.activation_id} initialActivation={result.activation} />
      </main>
      <Footer />
    </>
  );
}

function ActivationMissing({ id }: { id: string }) {
  return (
    <main className="state-screen">
      <h1>Activation not found</h1>
      <p>No activation matching &quot;{id}&quot; was returned by the backend.</p>
      <Link className="button-secondary" href="/">
        Return to marketplace
      </Link>
    </main>
  );
}
