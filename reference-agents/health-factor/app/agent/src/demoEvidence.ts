import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildHealthFactorOutcomeFromWorkPrompt,
  buildHealthFactorPromise,
  HealthFactorTaskSchema,
} from "./healthFactor.js";

const PROMISE_PREFIX = "SPONDEE_PROMISE_CARD_V1:";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const scenarioPath = resolve(
  process.cwd(),
  arg("--scenario", "../../demo/health-factor-scenario.json"),
);
const outputDir = resolve(process.cwd(), arg("--output", "../../demo-output"));
const task = HealthFactorTaskSchema.parse(JSON.parse(readFileSync(scenarioPath, "utf8")));

const promise = buildHealthFactorPromise(task, 0n);
const prompt =
  "You accepted and were paid for the following job. Produce the deliverable now.\n\n" +
  "JOB CONTEXT:\n" +
  JSON.stringify({
    task: JSON.stringify(task),
    terms: {
      success_criteria: [`${PROMISE_PREFIX}${JSON.stringify(promise)}`],
    },
  });
const receipt = buildHealthFactorOutcomeFromWorkPrompt(prompt);
if (receipt === null) {
  throw new Error("failed to create deterministic Spondee Outcome Receipt");
}

mkdirSync(outputDir, { recursive: true });
const artifacts = [
  ["PromiseCard.json", promise],
  ["OutcomeReceipt.json", receipt],
  ["Scenario.json", task],
] as const;
for (const [name, value] of artifacts) {
  const path = resolve(outputDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(path);
}
