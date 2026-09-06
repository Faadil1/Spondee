import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { SimpleNav } from "@/components/layout/SimpleNav";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { OutcomeReceiptView } from "@/components/receipt/OutcomeReceiptView";
import { listActivations } from "@/lib/api/activations";
import { getReceipt } from "@/lib/api/receipts";

type ReceiptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const { id } = await params;
  const result = await getReceipt(id);

  if (result.status === "unavailable") {
    return (
      <BackendUnavailableState
        title="Backend unavailable"
        copy="Spondee could not load the outcome receipt from the backend."
        detail={result.message}
      />
    );
  }

  if (result.status === "malformed") {
    return (
      <MalformedState
        title="Malformed receipt response"
        copy="The backend responded, but the receipt payload was not compatible with the frontend receipt contract."
        detail={result.message}
      />
    );
  }

  if (result.status === "not_found") {
    return <ReceiptMissing id={id} />;
  }

  if (result.status === "server_error") {
    return (
      <BackendUnavailableState
        title="Receipt fetch failed"
        copy="The backend could not return this outcome receipt."
        detail={result.message}
      />
    );
  }

  const activationLookup = await listActivations();
  const activation =
    activationLookup.status === "success"
      ? activationLookup.activations.find((candidate) => candidate.receipt_id === result.receipt.receipt_id) ?? null
      : null;
  const activationLookupMessage =
    activationLookup.status === "success"
      ? "No activation currently references this receipt."
      : activationLookup.message;

  return (
    <>
      <SimpleNav statusLabel="Outcome receipt" />
      <main className="detail-main">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href={`/agent/${result.receipt.agent_id}`}>
            <ArrowLeft aria-hidden="true" size={16} />
            {result.receipt.agent_id}
          </Link>
        </nav>
        <OutcomeReceiptView
          receipt={result.receipt}
          activation={activation}
          activationLookupMessage={activation ? undefined : activationLookupMessage}
        />
      </main>
      <Footer />
    </>
  );
}

function ReceiptMissing({ id }: { id: string }) {
  return (
    <main className="state-screen">
      <h1>Receipt not found</h1>
      <p>No outcome receipt matching &quot;{id}&quot; was returned by the backend.</p>
      <Link className="button-secondary" href="/">
        Return to marketplace
      </Link>
    </main>
  );
}
