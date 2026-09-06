"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, PlayCircle } from "lucide-react";
import type { ActivationCreateResult, ActivationMode, AgentRecord, PromiseCard, SpondeeTask } from "@/lib/api/types";
import { createActivation } from "@/lib/api/activations";
import { StatusPill } from "@/components/ui/StatusPill";

type ActivationLauncherProps = {
  agent: AgentRecord;
  promise: PromiseCard;
  task: SpondeeTask;
  liveTestnetReady: boolean;
};

export function ActivationLauncher({ agent, promise, task, liveTestnetReady }: ActivationLauncherProps) {
  const router = useRouter();
  const [mode, setMode] = useState<ActivationMode>("SIMULATION");
  const [result, setResult] = useState<Exclude<ActivationCreateResult, { status: "success" }> | null>(null);
  const [isPending, startTransition] = useTransition();

  const liveBlocked = mode === "LIVE_TESTNET" && !liveTestnetReady;

  function submitActivation() {
    setResult(null);
    startTransition(async () => {
      const next = await createActivation({ promiseId: promise.promise_id, task, mode });
      if (next.status === "success") {
        router.push(`/activation/${next.activation.activation_id}`);
        return;
      }
      setResult(next);
    });
  }

  return (
    <section className="activation-launcher" aria-label="Activation">
      <div className="activation-launcher-heading">
        <div>
          <p className="eyebrow">Activation</p>
          <h2>Choose the execution boundary</h2>
        </div>
        <StatusPill tone={agent.activatable ? "good" : "warn"}>
          {agent.activatable ? "Verified activation path" : "Not activation compatible"}
        </StatusPill>
      </div>

      <div className="mode-selector" role="radiogroup" aria-label="Activation mode">
        <button
          type="button"
          className={mode === "SIMULATION" ? "mode-option mode-option-active" : "mode-option"}
          onClick={() => setMode("SIMULATION")}
          aria-checked={mode === "SIMULATION"}
          role="radio"
        >
          <strong>SIMULATION</strong>
          <span>No blockchain execution. Produces a simulated activation state.</span>
        </button>
        <button
          type="button"
          className={mode === "LIVE_TESTNET" ? "mode-option mode-option-active" : "mode-option"}
          onClick={() => setMode("LIVE_TESTNET")}
          aria-checked={mode === "LIVE_TESTNET"}
          role="radio"
        >
          <strong>LIVE_TESTNET</strong>
          <span>{liveTestnetReady ? "Runtime write gate reports ready." : "Runtime write gate is closed."}</span>
        </button>
      </div>

      <dl className="activation-summary">
        <div>
          <dt>Selected Mode</dt>
          <dd>{mode}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{mode === "LIVE_TESTNET" ? agent.identity.network : "Simulation only"}</dd>
        </div>
        <div>
          <dt>Authority</dt>
          <dd>{mode === "LIVE_TESTNET" ? "Trusted server action required later" : "No wallet or live authority requested"}</dd>
        </div>
        <div>
          <dt>Expected Cost</dt>
          <dd>
            {promise.expected_cost.amount} {promise.expected_cost.currency}
          </dd>
        </div>
      </dl>

      {liveBlocked ? (
        <div className="activation-boundary">
          LIVE_TESTNET can be prepared, but it will remain BLOCKED_LIVE_GATE until server runtime configuration changes. This browser does not call the protected live-testnet endpoint.
        </div>
      ) : null}

      <button className="button-primary form-submit" type="button" onClick={submitActivation} disabled={isPending || !agent.activatable}>
        {isPending ? <Loader2 aria-hidden="true" className="spin" size={18} /> : <PlayCircle aria-hidden="true" size={18} />}
        {isPending ? "Creating activation" : liveBlocked ? "Prepare blocked live state" : "Activate"}
      </button>

      {result ? <ActivationCreateError result={result} /> : null}
    </section>
  );
}

function ActivationCreateError({ result }: { result: Exclude<ActivationCreateResult, { status: "success" }> }) {
  return (
    <div className="promise-error">
      <AlertTriangle aria-hidden="true" size={22} />
      <div>
        <h2>{result.status === "validation_error" ? "Activation validation failed" : "Activation failed"}</h2>
        <p>{result.message}</p>
        {"details" in result && result.details ? <pre>{JSON.stringify(result.details, null, 2)}</pre> : null}
      </div>
    </div>
  );
}
