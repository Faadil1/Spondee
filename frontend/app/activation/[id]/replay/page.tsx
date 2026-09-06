import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { SimpleNav } from "@/components/layout/SimpleNav";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { DecisionReplayView } from "@/components/replay/DecisionReplayView";
import { getDecisionReplay } from "@/lib/api/replay";

type ReplayPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReplayPage({ params }: ReplayPageProps) {
  const { id } = await params;
  const result = await getDecisionReplay(id);

  if (result.status === "unavailable") {
    return (
      <BackendUnavailableState
        title="Backend unavailable"
        copy="Spondee could not load the Decision Replay from the backend."
        detail={result.message}
      />
    );
  }

  if (result.status === "malformed") {
    return (
      <MalformedState
        title="Malformed replay response"
        copy="The backend responded, but the replay payload was not compatible with spondee.decision-replay.v1."
        detail={result.message}
      />
    );
  }

  if (result.status === "not_found") {
    return <ReplayMissing id={id} />;
  }

  if (result.status === "server_error") {
    return (
      <BackendUnavailableState
        title="Replay fetch failed"
        copy="The backend could not return this Decision Replay."
        detail={result.message}
      />
    );
  }

  return (
    <>
      <SimpleNav statusLabel="Read-only replay" />
      <main className="detail-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href={`/activation/${result.replay.activation_id}`}>
            <ArrowLeft aria-hidden="true" size={16} />
            Activation
          </Link>
        </nav>
        <DecisionReplayView replay={result.replay} />
      </main>
      <Footer />
    </>
  );
}

function ReplayMissing({ id }: { id: string }) {
  return (
    <main className="state-screen">
      <h1>Replay not found</h1>
      <p>No Decision Replay matching activation &quot;{id}&quot; was returned by the backend.</p>
      <Link className="button-secondary" href="/">
        Return to marketplace
      </Link>
    </main>
  );
}
