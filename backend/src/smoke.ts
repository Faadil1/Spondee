import { referenceAgentForCategory } from "./catalog.js";
import { DEMO_TASKS } from "./examples.js";
import { buildPromiseCard, buildSimulationReceipt, taskCategory } from "./engines.js";

const rows = DEMO_TASKS.map((task) => {
  const category = taskCategory(task);
  const agent = referenceAgentForCategory(category);
  const promise = buildPromiseCard(task, agent.agent_id, agent.version, 0n);
  const receipt = buildSimulationReceipt(task, promise);
  return {
    category,
    agent_id: agent.agent_id,
    promise_id: promise.promise_id,
    confidence: promise.confidence,
    service_price: promise.expected_cost.amount,
    receipt_id: receipt.receipt_id,
    evidence_class: receipt.evidence_class,
    observed_advantage_eligible: receipt.calibration.eligible_for_observed_agent_advantage,
  };
});

console.log(JSON.stringify({
  schema: "spondee.backend-smoke.v1",
  generated_at: new Date().toISOString(),
  live_write_attempted: false,
  category_count: rows.length,
  rows,
}, null, 2));
