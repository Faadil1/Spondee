import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BadgeCheck, BarChart3, CircleSlash, FileSearch, MinusCircle, Radio, TrendingDown } from "lucide-react";
import type { AgentRecord, AgentAdvantageReport, CalibrationSummary, EvidenceRun } from "@/lib/api/types";
import { formatTimestamp, labelize, stringifyMetric } from "@/lib/utils/format";
import { StatusPill } from "@/components/ui/StatusPill";

type EvidenceDashboardProps = {
  report: AgentAdvantageReport;
  runs: EvidenceRun[];
  agents: AgentRecord[];
  calibrations: Record<string, CalibrationSummary | null>;
};

export function EvidenceDashboard({ report, runs, agents, calibrations }: EvidenceDashboardProps) {
  const observedRuns = runs.filter((run) => run.evidence_class === "OBSERVED");
  const simulationRuns = runs.filter((run) => run.evidence_class === "SIMULATION");

  return (
    <div className="evidence-page-layout">
      <section className="evidence-hero">
        <div>
          <p className="eyebrow">Evidence</p>
          <h1>Runtime evidence, separated from repository claims.</h1>
          <p>
            This page renders runtime evidence APIs only. Repository-preserved canonical evidence appears here only after
            the backend store has been initialized with those runs.
          </p>
        </div>
        <StatusPill tone={report.status === "READY" ? "good" : "warn"}>{report.status}</StatusPill>
      </section>

      <section className="receipt-facts" aria-label="Evidence summary">
        <Fact icon={FileSearch} label="Observed runs" value={String(report.observed_run_count)} />
        <Fact icon={BadgeCheck} label="Paired runs" value={String(report.paired_run_count)} />
        <Fact icon={MinusCircle} label="Simulation excluded" value={String(report.excluded_simulation_count)} />
        <Fact icon={Radio} label="Runtime runs loaded" value={String(runs.length)} />
      </section>

      {runs.length === 0 ? (
        <section className="receipt-panel">
          <div className="comparison-missing">
            <CircleSlash aria-hidden="true" size={20} />
            <p>
              No runtime evidence runs were returned by <code>GET /v1/evidence/runs</code>. This is an empty runtime
              store state, not proof that preserved repository evidence is absent.
            </p>
          </div>
        </section>
      ) : null}

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Agent Advantage</p>
          <h2>Measured pairs</h2>
        </div>
        {report.pairs.length ? (
          <div className="evidence-run-grid">
            {report.pairs.map((pair) => (
              <article className="evidence-run-card" key={`${pair.run_id}-${pair.baseline_run_id}`}>
                <h3>{pair.category}</h3>
                <dl>
                  <div>
                    <dt>Agent run</dt>
                    <dd>
                      <Link className="text-link" href={`/evidence/${pair.run_id}`}>
                        {pair.run_id}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Baseline run</dt>
                    <dd>
                      <Link className="text-link" href={`/evidence/${pair.baseline_run_id}`}>
                        {pair.baseline_run_id}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Delta</dt>
                    <dd>{stringifyMetric(pair.advantage_delta)}</dd>
                  </div>
                  <div>
                    <dt>Calibration error</dt>
                    <dd>{pair.calibration_error ?? "Not scored"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            Runtime Agent Advantage is {labelize(report.status)} because fewer than three countable observed pairs are
            present.
          </p>
        )}
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Evidence Runs</p>
          <h2>Observed, simulation, negative and neutral results remain visible</h2>
        </div>
        {runs.length ? (
          <div className="evidence-run-grid">
            {runs.map((run) => (
              <EvidenceRunCard key={run.run_id} run={run} />
            ))}
          </div>
        ) : (
          <p className="empty-state">No evidence runs returned by the runtime API.</p>
        )}
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Calibration</p>
          <h2>Confidence remains absent until scored observed history exists</h2>
        </div>
        <div className="evidence-run-grid">
          {agents
            .filter((agent) => agent.identity.source === "SPONDEE")
            .map((agent) => {
              const calibration = calibrations[agent.agent_id] ?? null;
              return (
                <article className="evidence-run-card" key={agent.agent_id}>
                  <h3>{agent.name}</h3>
                  {calibration ? (
                    <dl>
                      <div>
                        <dt>Observed runs</dt>
                        <dd>{calibration.observed_run_count}</dd>
                      </div>
                      <div>
                        <dt>Scored calibration</dt>
                        <dd>{calibration.scored_calibration_count}</dd>
                      </div>
                      <div>
                        <dt>Mean calibration error</dt>
                        <dd>{calibration.mean_calibration_error ?? "Insufficient history"}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{labelize(calibration.status)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p>Calibration summary was not returned for this agent.</p>
                  )}
                </article>
              );
            })}
        </div>
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Runtime Split</p>
          <h2>Observed vs simulation</h2>
        </div>
        <dl className="receipt-definition-list">
          <div>
            <dt>OBSERVED</dt>
            <dd>{observedRuns.length} runtime runs</dd>
          </div>
          <div>
            <dt>SIMULATION</dt>
            <dd>{simulationRuns.length} runtime runs excluded from Agent Advantage</dd>
          </div>
          <div>
            <dt>Negative evidence</dt>
            <dd>Valid when measured by runtime evidence; not treated as failure.</dd>
          </div>
          <div>
            <dt>Neutral evidence</dt>
            <dd>Valid when measured by runtime evidence; not hidden.</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

export function EvidenceRunDetail({ run }: { run: EvidenceRun }) {
  return (
    <div className="evidence-page-layout">
      <section className="evidence-hero">
        <div>
          <p className="eyebrow">Evidence Run</p>
          <h1>{run.run_id}</h1>
          <p>
            This detail page is loaded from <code>GET /v1/evidence/runs/:id</code> and does not read repository
            evidence files.
          </p>
        </div>
        <StatusPill tone={run.evidence_class === "OBSERVED" ? "good" : "warn"}>{run.evidence_class}</StatusPill>
      </section>

      <section className="receipt-facts">
        <Fact icon={BarChart3} label="Category" value={run.category} />
        <Fact icon={BadgeCheck} label="Agent" value={run.agent_id} />
        <Fact icon={TrendingDown} label="Baseline" value={run.baseline_run_id ?? "No baseline"} />
        <Fact icon={Radio} label="Confidence" value={run.confidence === null ? "Not scored" : String(run.confidence)} />
      </section>

      <section className="receipt-panel">
        <div className="receipt-section-heading">
          <p className="eyebrow">Measured Data</p>
          <h2>Promise, actual outcome and cost</h2>
        </div>
        <dl className="receipt-definition-list">
          <div>
            <dt>Scenario</dt>
            <dd>{run.scenario_id}</dd>
          </div>
          <div>
            <dt>Promise timestamp</dt>
            <dd>{formatTimestamp(run.promise_timestamp)}</dd>
          </div>
          <div>
            <dt>Advantage delta</dt>
            <dd>{stringifyMetric(run.advantage_delta)}</dd>
          </div>
          <div>
            <dt>Calibration error</dt>
            <dd>{run.calibration_error ?? "Not scored"}</dd>
          </div>
          <div>
            <dt>Transactions</dt>
            <dd>{run.tx_hashes.length ? run.tx_hashes.join(", ") : "No transaction hashes returned"}</dd>
          </div>
          <div>
            <dt>Artifacts</dt>
            <dd>{run.output_artifacts.length ? run.output_artifacts.join(", ") : "No artifacts returned"}</dd>
          </div>
        </dl>
        <div className="evidence-json-grid">
          <JsonPanel title="Expected outcome" value={run.expected_outcome} />
          <JsonPanel title="Expected downside" value={run.expected_downside} />
          <JsonPanel title="Expected cost" value={run.expected_cost} />
          <JsonPanel title="Actual outcome" value={run.actual_outcome} />
          <JsonPanel title="Actual cost" value={run.actual_cost} />
        </div>
        {run.notes ? <p className="empty-state">{run.notes}</p> : null}
      </section>
    </div>
  );
}

function EvidenceRunCard({ run }: { run: EvidenceRun }) {
  return (
    <article className="evidence-run-card">
      <div className="evidence-run-card-top">
        <h3>
          <Link href={`/evidence/${run.run_id}`}>{run.run_id}</Link>
        </h3>
        <StatusPill tone={run.evidence_class === "OBSERVED" ? "good" : "warn"}>{run.evidence_class}</StatusPill>
      </div>
      <dl>
        <div>
          <dt>Category</dt>
          <dd>{run.category}</dd>
        </div>
        <div>
          <dt>Agent</dt>
          <dd>{run.agent_id}</dd>
        </div>
        <div>
          <dt>Baseline</dt>
          <dd>{run.baseline_run_id ?? "No baseline"}</dd>
        </div>
        <div>
          <dt>Advantage delta</dt>
          <dd>{stringifyMetric(run.advantage_delta)}</dd>
        </div>
      </dl>
    </article>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <section>
      <h3>{title}</h3>
      <pre className="json-block">{JSON.stringify(value ?? "Unavailable", null, 2)}</pre>
    </section>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="detail-fact">
      <Icon aria-hidden="true" size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
