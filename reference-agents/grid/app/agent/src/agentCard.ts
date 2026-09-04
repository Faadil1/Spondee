import type { AgentCard, AgentSkill, SecurityScheme } from "@a2a-js/sdk";
import { loadStudioToml } from "@bnbagent/studio-runtime/config";
import { currentAgentMetadata } from "./healthFactor.js";

const PREVIEW_SKILL_ID = "preview_health_factor"; // transport-compatible id retained from the proven seller template

function previewSkill(): AgentSkill {
  const meta = currentAgentMetadata();
  return {
    id: PREVIEW_SKILL_ID,
    name: `Preview a ${meta.label} promise`,
    description:
      `Send {\"skill\":\"${PREVIEW_SKILL_ID}\",\"task\":{...}} with a ${meta.taskSchema} simulation. ` +
      "Returns a deterministic Promise Card before activation. Confidence remains UNSCORED until observed calibration; no payment, signing, or LLM call occurs.",
    tags: [meta.kind, "spondee", "promise-card", "bnb-chain"],
    inputModes: ["application/json"],
    outputModes: ["application/json"],
  };
}

const NEGOTIATE: AgentSkill = {
  id: "negotiate",
  name: "Negotiate an ERC-8183 job",
  description:
    "Send the structured Spondee task plus ERC-8183 terms and receive a wallet-signed zero-price quote. The quote carries one compact Promise commitment in success_criteria.",
  tags: ["erc8183", "negotiation", "spondee", "bnb-chain"],
  inputModes: ["application/json"],
  outputModes: ["application/json"],
};

const NOTIFY_FUNDED: AgentSkill = {
  id: "notify_funded",
  name: "Notify the seller a job is funded",
  description:
    "After funding a bounded ERC-8183 testnet job, send the job_id. The seller verifies the signed job, acknowledges immediately and produces the deterministic category receipt in the background.",
  tags: ["erc8183", "delivery", "spondee", "bnb-chain"],
  inputModes: ["application/json"],
  outputModes: ["application/json"],
};

function agentName(): string {
  try {
    const cfg = loadStudioToml();
    return String(((cfg.project ?? {}) as Record<string, unknown>).name ?? "") || currentAgentMetadata().label;
  } catch {
    return currentAgentMetadata().label;
  }
}

function oauth2Scheme(): SecurityScheme | null {
  const tokenUrl = process.env.OAUTH_TOKEN_URL;
  const scope = process.env.OAUTH_SCOPE;
  if (!tokenUrl || !scope) return null;
  return {
    type: "oauth2",
    flows: { clientCredentials: { tokenUrl, scopes: { [scope]: "Invoke the seller agent" } } },
  };
}

export function buildAgentCard(opts: { commerceSkills?: boolean } = {}): AgentCard {
  const meta = currentAgentMetadata();
  const name = agentName();
  const extra: Partial<AgentCard> = {};
  const scheme = oauth2Scheme();
  if (scheme !== null) {
    const scope = process.env.OAUTH_SCOPE as string;
    extra.securitySchemes = { oauth2: scheme };
    extra.security = [{ oauth2: [scope] }];
  }
  return {
    name,
    description: `${meta.label} (${name}) — deterministic ${meta.category} Promise Card, bounded ERC-8183 activation and Outcome Receipt.`,
    url: process.env.AGENTCORE_RUNTIME_URL ?? `http://${process.env.AGENT_HOST ?? "localhost"}:${process.env.AGENT_PORT || "9000"}/`,
    version: "1.0.0",
    protocolVersion: "0.3.0",
    preferredTransport: "JSONRPC",
    capabilities: { streaming: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    skills: opts.commerceSkills === false ? [previewSkill()] : [previewSkill(), NEGOTIATE, NOTIFY_FUNDED],
    ...extra,
  };
}
