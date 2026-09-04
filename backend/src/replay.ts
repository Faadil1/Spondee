import type { ActivationRecord, OutcomeReceipt } from "./contracts.js";

export interface DecisionReplay {
  schema: "spondee.decision-replay.v1";
  replay_mode: "READ_ONLY_RECONSTRUCTION";
  activation_id: string;
  category: ActivationRecord["category"];
  agent_id: string;
  scenario_id: string;
  promise_id: string;
  status: ActivationRecord["status"];
  truth: {
    promise_evidence_class: "SIMULATION";
    receipt_evidence_class: "SIMULATION" | null;
    observed_agent_advantage_eligible: false | null;
    chain_transport_observed: boolean;
    reexecution_performed: false;
  };
  inputs: ActivationRecord["task"];
  promise: ActivationRecord["promise"];
  authority: {
    mode: ActivationRecord["mode"];
    network: ActivationRecord["chain"]["network"];
    job_id: string | null;
    transaction_hashes: string[];
    deliverable_url: string | null;
  };
  outcome: OutcomeReceipt | null;
  timeline: Array<{
    type: "PROMISE_PREPARED" | "ACTIVATION_CREATED" | "CHAIN_TRANSACTION" | "OUTCOME_RECEIPT" | "ACTIVATION_UPDATED" | "FAILURE";
    at: string | null;
    label: string;
    reference: string | null;
  }>;
  claim_guardrail: string;
}

export function buildDecisionReplay(
  activation: ActivationRecord,
  receipt: OutcomeReceipt | null,
): DecisionReplay {
  const timeline: DecisionReplay["timeline"] = [
    {
      type: "PROMISE_PREPARED",
      at: activation.promise.created_at,
      label: "Promise Card prepared before activation",
      reference: activation.promise.promise_id,
    },
    {
      type: "ACTIVATION_CREATED",
      at: activation.created_at,
      label: `${activation.mode} activation created`,
      reference: activation.activation_id,
    },
  ];

  for (const tx of activation.chain.tx_hashes) {
    timeline.push({
      type: "CHAIN_TRANSACTION",
      at: null,
      label: "BSC testnet transaction recorded",
      reference: tx,
    });
  }

  if (receipt) {
    timeline.push({
      type: "OUTCOME_RECEIPT",
      at: receipt.created_at,
      label: "Outcome Receipt recorded",
      reference: receipt.receipt_id,
    });
  }

  if (activation.failure_reason) {
    timeline.push({
      type: "FAILURE",
      at: activation.updated_at,
      label: activation.failure_reason,
      reference: null,
    });
  } else if (activation.updated_at !== activation.created_at) {
    timeline.push({
      type: "ACTIVATION_UPDATED",
      at: activation.updated_at,
      label: `Activation status: ${activation.status}`,
      reference: null,
    });
  }

  return {
    schema: "spondee.decision-replay.v1",
    replay_mode: "READ_ONLY_RECONSTRUCTION",
    activation_id: activation.activation_id,
    category: activation.category,
    agent_id: activation.agent_id,
    scenario_id: activation.scenario_id,
    promise_id: activation.promise_id,
    status: activation.status,
    truth: {
      promise_evidence_class: activation.promise.evidence_class,
      receipt_evidence_class: receipt?.evidence_class ?? null,
      observed_agent_advantage_eligible:
        receipt?.calibration.eligible_for_observed_agent_advantage ?? null,
      chain_transport_observed: activation.chain.tx_hashes.length > 0,
      reexecution_performed: false,
    },
    inputs: structuredClone(activation.task),
    promise: structuredClone(activation.promise),
    authority: {
      mode: activation.mode,
      network: activation.chain.network,
      job_id: activation.chain.job_id,
      transaction_hashes: [...activation.chain.tx_hashes],
      deliverable_url: activation.chain.deliverable_url,
    },
    outcome: receipt ? structuredClone(receipt) : null,
    timeline,
    claim_guardrail:
      "Decision Replay reconstructs preserved inputs, Promise, authority and Outcome Receipt. It never re-executes a financial action and never promotes SIMULATION evidence to OBSERVED.",
  };
}
