#!/usr/bin/env node

const args = new Map();
const flags = new Set();

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) {
    flags.add(key);
  } else {
    args.set(key, next);
    index += 1;
  }
}

const backend = normalizeUrl(args.get("backend") ?? process.env.SPONDEE_BACKEND_URL ?? "http://localhost:8787");
const frontend = normalizeUrl(args.get("frontend") ?? process.env.SPONDEE_FRONTEND_URL ?? "http://localhost:3000");
const localSimulation = flags.has("local-mutating-simulation");

const failures = [];

function normalizeUrl(value) {
  return String(value).trim().replace(/\/$/, "");
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${readError(body)}`);
  return body;
}

async function getText(url) {
  const response = await fetch(url, { headers: { accept: "text/html" } });
  const body = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return body;
}

function readError(body) {
  return body && typeof body === "object" && typeof body.error === "string" ? body.error : "no JSON error";
}

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL ${name}: ${message}`);
  }
}

await check("backend health", async () => {
  const body = await getJson(`${backend}/healthz`);
  if (body?.ok !== true) throw new Error("healthz did not return ok: true");
  return body.service ?? "ok";
});

let bootstrap = null;
await check("product bootstrap", async () => {
  bootstrap = await getJson(`${backend}/v1/product/bootstrap`);
  if (bootstrap.schema !== "spondee.frontend-bootstrap.v1") throw new Error(`unexpected schema ${bootstrap.schema}`);
  if (!Array.isArray(bootstrap.categories) || bootstrap.categories.length !== 4) {
    throw new Error(`expected 4 categories, got ${bootstrap.categories?.length ?? "missing"}`);
  }
  return `${bootstrap.categories.length} categories`;
});

await check("agent advantage report", async () => {
  const body = await getJson(`${backend}/v1/evidence/agent-advantage`);
  if (!body?.report || typeof body.report.paired_run_count !== "number") {
    throw new Error("missing report.paired_run_count");
  }
  return `${body.report.paired_run_count} paired runtime runs, ${body.report.status}`;
});

await check("evidence run list", async () => {
  const body = await getJson(`${backend}/v1/evidence/runs`);
  if (!Array.isArray(body?.evidence)) throw new Error("missing evidence array");
  return `${body.evidence.length} runtime records`;
});

for (const path of ["/", "/evidence"]) {
  await check(`frontend ${path}`, async () => {
    const html = await getText(`${frontend}${path}`);
    if (!html.includes("Spondee")) throw new Error("response did not include Spondee");
    return "html loaded";
  });
}

if (localSimulation) {
  await check("local simulation activation", async () => {
    if (!bootstrap) throw new Error("bootstrap unavailable");
    const task = bootstrap.demo_tasks?.find((candidate) => candidate.schema === "spondee.health-factor.task.v1")
      ?? bootstrap.demo_tasks?.[0];
    if (!task) throw new Error("no demo task returned");
    const previewResponse = await fetch(`${backend}/v1/promises/preview`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ task }),
    });
    const preview = await previewResponse.json().catch(() => null);
    if (!previewResponse.ok || !preview?.promise?.promise_id) {
      throw new Error(`promise preview failed: ${readError(preview)}`);
    }
    const activationResponse = await fetch(`${backend}/v1/activations`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ promise_id: preview.promise.promise_id, task, mode: "SIMULATION" }),
    });
    const activation = await activationResponse.json().catch(() => null);
    if (!activationResponse.ok || activation?.activation?.status !== "SIMULATED") {
      throw new Error(`simulation activation failed: ${readError(activation)}`);
    }
    return activation.activation.activation_id;
  });
}

if (failures.length) {
  console.error("");
  console.error("Smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("");
  console.log("Smoke passed. No protected endpoints were called and no token values were read.");
}
