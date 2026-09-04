import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildCategoryPromise,
  buildHealthFactorOutcomeFromWorkPrompt,
  currentAgentMetadata,
  demoTaskForCurrentAgent,
  encodeCategoryPromiseCommitmentCriterion,
  encodeCategoryTaskForChain,
} from "./healthFactor.js";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const outputDir = resolve(process.cwd(), arg("--output", "../../demo-output"));
const task = demoTaskForCurrentAgent();
const promise = buildCategoryPromise(task, 0n);
const prompt =
  "You accepted and were paid for the following job. Produce the deliverable now.\n\n" +
  "JOB CONTEXT:\n" +
  JSON.stringify({
    task: encodeCategoryTaskForChain(task),
    terms: { success_criteria: [encodeCategoryPromiseCommitmentCriterion(promise)] },
  });
const receipt = buildHealthFactorOutcomeFromWorkPrompt(prompt);
if (receipt === null) throw new Error("failed to create deterministic Spondee Outcome Receipt");

mkdirSync(outputDir, { recursive: true });
for (const [name, value] of [
  ["Agent.json", currentAgentMetadata()],
  ["PromiseCard.json", promise],
  ["OutcomeReceipt.json", receipt],
  ["Scenario.json", task],
] as const) {
  const path = resolve(outputDir, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(path);
}
