import { AlertTriangle, Loader2, ServerCrash } from "lucide-react";

type StateScreenProps = {
  title: string;
  copy: string;
  detail?: string;
};

export function LoadingState() {
  return (
    <main className="state-screen">
      <Loader2 aria-hidden="true" className="spin" size={32} />
      <h1>Loading Spondee marketplace</h1>
      <p>Requesting the frontend bootstrap from the backend.</p>
    </main>
  );
}

export function BackendUnavailableState({ title, copy, detail }: StateScreenProps) {
  return (
    <main className="state-screen">
      <ServerCrash aria-hidden="true" size={34} />
      <h1>{title}</h1>
      <p>{copy}</p>
      {detail ? <code>{detail}</code> : null}
    </main>
  );
}

export function MalformedState({ title, copy, detail }: StateScreenProps) {
  return (
    <main className="state-screen">
      <AlertTriangle aria-hidden="true" size={34} />
      <h1>{title}</h1>
      <p>{copy}</p>
      {detail ? <code>{detail}</code> : null}
    </main>
  );
}
