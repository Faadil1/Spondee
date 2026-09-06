import { Footer } from "@/components/layout/Footer";
import { TopNav } from "@/components/layout/TopNav";
import { EvidenceDashboard } from "@/components/evidence/EvidenceDashboard";
import { BackendUnavailableState, MalformedState } from "@/components/marketplace/StateScreens";
import { getProductBootstrap } from "@/lib/api/bootstrap";
import { getAgentAdvantageReport, getAgentCalibration, listEvidenceRuns } from "@/lib/api/evidence";
import type { CalibrationSummary } from "@/lib/api/types";

export default async function EvidencePage() {
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

  const [reportResult, runsResult, calibrationEntries] = await Promise.all([
    getAgentAdvantageReport(),
    listEvidenceRuns(),
    Promise.all(
      bootstrap.data.agents
        .filter((agent) => agent.identity.source === "SPONDEE")
        .map(async (agent) => {
          const result = await getAgentCalibration(agent.agent_id);
          return [agent.agent_id, result.status === "success" ? result.calibration : null] as const;
        }),
    ),
  ]);

  if (reportResult.status === "unavailable" || runsResult.status === "unavailable") {
    return (
      <BackendUnavailableState
        title="Evidence API unavailable"
        copy="Spondee could not load the runtime evidence APIs."
        detail={reportResult.status === "unavailable" ? reportResult.message : errorMessage(runsResult)}
      />
    );
  }

  if (reportResult.status === "malformed" || runsResult.status === "malformed") {
    return (
      <MalformedState
        title="Malformed evidence response"
        copy="The backend responded, but one evidence payload was not compatible with the frontend contract."
        detail={reportResult.status === "malformed" ? reportResult.message : errorMessage(runsResult)}
      />
    );
  }

  if (reportResult.status === "server_error" || runsResult.status === "server_error") {
    return (
      <BackendUnavailableState
        title="Evidence fetch failed"
        copy="The backend could not return the runtime evidence report."
        detail={reportResult.status === "server_error" ? reportResult.message : errorMessage(runsResult)}
      />
    );
  }

  const calibrations = Object.fromEntries(calibrationEntries) as Record<string, CalibrationSummary | null>;

  return (
    <>
      <TopNav bootstrap={bootstrap.data} />
      <main className="detail-main">
        <EvidenceDashboard
          report={reportResult.report}
          runs={runsResult.evidence}
          agents={bootstrap.data.agents}
          calibrations={calibrations}
        />
      </main>
      <Footer />
    </>
  );
}

function errorMessage(result: { status: string; message?: string }) {
  return result.message ?? "Unexpected evidence API state.";
}
