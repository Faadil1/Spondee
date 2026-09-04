import type { AgentRecord, Category } from "./contracts.js";

const SPONDEE_TESTNET_PROVIDER = "0x3CC4d66BD9f872d803c1Ce063c1426fB7aec38A8";

export const AGENTS: readonly AgentRecord[] = [
  {
    agent_id: "spondee-health-factor",
    name: "Spondee Health Factor",
    version: "0.1.0",
    category: "Health Factor Monitoring",
    description: "Deterministic Health Factor warning and Intervention Advantage reference agent.",
    readiness: "LIVE_TESTNET_VERIFIED",
    activatable: true,
    identity: {
      source: "SPONDEE",
      registry_agent_id: null,
      network: "bsc-testnet",
      provider_address: SPONDEE_TESTNET_PROVIDER,
      identity_url: null,
    },
    activation_proof: {
      status: "VERIFIED_LIVE_TESTNET",
      network: "bsc-testnet",
      job_id: "949",
      evidence_ref: "evidence/g3-job-949-final-pass/README.md",
    },
    capabilities: ["promise-card", "health-factor-monitoring", "erc8183-zero-price", "outcome-receipt"],
    promise_schema: "spondee.promise-card.v1",
    receipt_schema: "spondee.outcome-receipt.v1",
  },
  {
    agent_id: "spondee-grid",
    name: "Spondee Grid",
    version: "0.1.0",
    category: "Grid Trading",
    description: "Bounded Grid reference agent with verified BSC-testnet activation and observed forward-market evidence support.",
    readiness: "LIVE_TESTNET_VERIFIED",
    activatable: true,
    identity: {
      source: "SPONDEE",
      registry_agent_id: null,
      network: "bsc-testnet",
      provider_address: SPONDEE_TESTNET_PROVIDER,
      identity_url: null,
    },
    activation_proof: {
      status: "VERIFIED_LIVE_TESTNET",
      network: "bsc-testnet",
      job_id: "954",
      evidence_ref: "evidence/g4-grid-job-954-final-pass/README.md",
    },
    capabilities: ["promise-card", "grid-analysis", "range-break", "outcome-receipt", "observed-forward-pair"],
    promise_schema: "spondee.promise-card.v1",
    receipt_schema: "spondee.outcome-receipt.v1",
  },
  {
    agent_id: "spondee-rebalancing",
    name: "Spondee Rebalancing",
    version: "0.1.0",
    category: "Rebalancing",
    description: "Deterministic LP range-exit and bounded reset-plan reference agent.",
    readiness: "LIVE_TESTNET_VERIFIED",
    activatable: true,
    identity: {
      source: "SPONDEE",
      registry_agent_id: null,
      network: "bsc-testnet",
      provider_address: SPONDEE_TESTNET_PROVIDER,
      identity_url: null,
    },
    activation_proof: {
      status: "VERIFIED_LIVE_TESTNET",
      network: "bsc-testnet",
      job_id: "955",
      evidence_ref: "evidence/g4-rebalancing-job-955-final-pass/README.md",
    },
    capabilities: ["promise-card", "lp-range-monitoring", "reset-plan", "outcome-receipt"],
    promise_schema: "spondee.promise-card.v1",
    receipt_schema: "spondee.outcome-receipt.v1",
  },
  {
    agent_id: "spondee-yield",
    name: "Spondee Yield",
    version: "0.1.0",
    category: "Yield Optimisation",
    description: "Deterministic risk-bounded yield-option comparison reference agent.",
    readiness: "LIVE_TESTNET_VERIFIED",
    activatable: true,
    identity: {
      source: "SPONDEE",
      registry_agent_id: null,
      network: "bsc-testnet",
      provider_address: SPONDEE_TESTNET_PROVIDER,
      identity_url: null,
    },
    activation_proof: {
      status: "VERIFIED_LIVE_TESTNET",
      network: "bsc-testnet",
      job_id: "957",
      evidence_ref: "evidence/g4-yield-job-957-final-pass/README.md",
    },
    capabilities: ["promise-card", "yield-comparison", "risk-filter", "outcome-receipt"],
    promise_schema: "spondee.promise-card.v1",
    receipt_schema: "spondee.outcome-receipt.v1",
  },
  {
    agent_id: "8004scan-defimatrix-171927",
    name: "DeFiMatrix.agent",
    version: "external",
    category: "Yield Optimisation",
    description: "External BSC agent surfaced as discovery substrate only; Spondee does not claim activation control.",
    readiness: "DISCOVERY_ONLY_EXTERNAL",
    activatable: false,
    identity: {
      source: "8004SCAN",
      registry_agent_id: "171927",
      network: "bsc",
      provider_address: null,
      identity_url: null,
    },
    activation_proof: {
      status: "UNVERIFIED_EXTERNAL",
      network: "bsc",
      job_id: null,
      evidence_ref: null,
    },
    capabilities: ["external-discovery", "yield", "rebalancing"],
    promise_schema: "spondee.promise-card.v1",
    receipt_schema: "spondee.outcome-receipt.v1",
  },
  {
    agent_id: "8004scan-speraxos-6441",
    name: "DeFi Trading Agent SperaxOS",
    version: "external",
    category: "Yield Optimisation",
    description: "External BSC agent surfaced as discovery substrate only; no Spondee activation claim.",
    readiness: "DISCOVERY_ONLY_EXTERNAL",
    activatable: false,
    identity: {
      source: "8004SCAN",
      registry_agent_id: "6441",
      network: "bsc",
      provider_address: null,
      identity_url: null,
    },
    activation_proof: {
      status: "UNVERIFIED_EXTERNAL",
      network: "bsc",
      job_id: null,
      evidence_ref: null,
    },
    capabilities: ["external-discovery", "yield", "swaps"],
    promise_schema: "spondee.promise-card.v1",
    receipt_schema: "spondee.outcome-receipt.v1",
  },
];

export function listAgents(category?: Category): AgentRecord[] {
  return AGENTS.filter((agent) => category === undefined || agent.category === category).map((a) => structuredClone(a));
}

export function getAgent(agentId: string): AgentRecord | null {
  const found = AGENTS.find((agent) => agent.agent_id === agentId);
  return found ? structuredClone(found) : null;
}

export function referenceAgentForCategory(category: Category): AgentRecord {
  const found = AGENTS.find(
    (agent) => agent.category === category && agent.identity.source === "SPONDEE",
  );
  if (!found) throw new Error(`No Spondee reference agent for ${category}`);
  return structuredClone(found);
}
