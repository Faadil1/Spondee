"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Loader2, WandSparkles } from "lucide-react";
import type { AgentRecord, PromiseCard as PromiseCardType, PromisePreviewResult, SpondeeTask } from "@/lib/api/types";
import { previewPromise } from "@/lib/api/promises";
import { ActivationLauncher } from "@/components/activation/ActivationLauncher";
import { PromiseCard } from "@/components/promise/PromiseCard";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  GridTaskFields,
  HealthTaskFields,
  RebalancingTaskFields,
  YieldTaskFields,
} from "./TaskFields";

type TaskConfiguratorProps = {
  initialTask: SpondeeTask;
  agent: AgentRecord;
  liveTestnetReady: boolean;
};

export function TaskConfigurator({ initialTask, agent, liveTestnetReady }: TaskConfiguratorProps) {
  const [task, setTask] = useState<SpondeeTask>(() => structuredClone(initialTask));
  const [result, setResult] = useState<PromisePreviewResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const promise = result?.status === "success" ? result.promise : null;
  const error = result && result.status !== "success" ? result : null;

  const fields = useMemo(() => {
    switch (task.schema) {
      case "spondee.health-factor.task.v1":
        return <HealthTaskFields task={task} onChange={setTask} />;
      case "spondee.grid.task.v1":
        return <GridTaskFields task={task} onChange={setTask} />;
      case "spondee.rebalancing.task.v1":
        return <RebalancingTaskFields task={task} onChange={setTask} />;
      case "spondee.yield.task.v1":
        return <YieldTaskFields task={task} onChange={setTask} />;
    }
  }, [task]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    startTransition(async () => {
      setResult(await previewPromise(task, agent.agent_id));
    });
  }

  return (
    <div className="configure-layout">
      <form className="task-form" onSubmit={onSubmit}>
        <div className="form-heading">
          <div>
            <p className="eyebrow">Configure Task</p>
            <h2>{agent.category}</h2>
          </div>
          <StatusPill tone="warn">{task.evidence_class}</StatusPill>
        </div>

        <div className="form-section">
          <label htmlFor="scenario_id">Scenario ID</label>
          <input
            id="scenario_id"
            value={task.scenario_id}
            onChange={(event) => setTask({ ...task, scenario_id: event.target.value })}
          />
        </div>

        {fields}

        <div className="form-guardrail">
          This creates a Promise Card only. It does not activate an agent, request wallet authority, or perform a live write.
        </div>

        <button className="button-primary form-submit" type="submit" disabled={isPending}>
          {isPending ? <Loader2 aria-hidden="true" className="spin" size={18} /> : <WandSparkles aria-hidden="true" size={18} />}
          {isPending ? "Generating Promise" : "Generate Promise"}
        </button>
      </form>

      <aside className="promise-side">
        {promise ? (
          <>
            <PromiseCard promise={promise as PromiseCardType} agent={agent} />
            <ActivationLauncher
              agent={agent}
              promise={promise as PromiseCardType}
              task={task}
              liveTestnetReady={liveTestnetReady}
            />
          </>
        ) : null}
        {error ? <PromiseError result={error} /> : null}
        {!promise && !error ? (
          <div className="promise-empty">
            <p className="eyebrow">Promise Preview</p>
            <h2>Ready to generate</h2>
            <p>The Promise Card appears here after the backend validates this task.</p>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function PromiseError({ result }: { result: Exclude<PromisePreviewResult, { status: "success" }> }) {
  return (
    <div className={`promise-error promise-error-${result.status}`}>
      <AlertTriangle aria-hidden="true" size={22} />
      <div>
        <h2>{result.status === "validation_error" ? "Task validation failed" : "Promise preview failed"}</h2>
        <p>{result.message}</p>
        {"details" in result && result.details ? <pre>{JSON.stringify(result.details, null, 2)}</pre> : null}
      </div>
    </div>
  );
}
