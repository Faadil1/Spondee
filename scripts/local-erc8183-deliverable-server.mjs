import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const host = process.env.SPONDEE_LOCAL_DELIVERABLE_HOST?.trim() || "127.0.0.1";
const port = Number(process.env.SPONDEE_LOCAL_DELIVERABLE_PORT || "9100");
const storageRoot = resolve(
  process.env.SPONDEE_LOCAL_DELIVERABLE_DIR?.trim() || ".agent-data",
);

function json(res, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      status: "HEALTHY",
      storage_root: storageRoot,
      schema: "spondee.local-erc8183-deliverable-server.v1",
    });
    return;
  }

  const match = /^\/erc8183\/job\/(\d+)\/response$/.exec(url.pathname);
  if (req.method !== "GET" || !match) {
    json(res, 404, { error: "not_found" });
    return;
  }

  const jobId = match[1];
  const filePath = resolve(storageRoot, `erc8183-job-${jobId}.json`);
  const expectedPrefix = `${storageRoot.replace(/[\\/]+$/, "")}\\`;
  const normalizedFile = filePath.replace(/\//g, "\\");
  const normalizedRoot = storageRoot.replace(/\//g, "\\");
  if (
    normalizedFile !== `${normalizedRoot}\\erc8183-job-${jobId}.json` &&
    !normalizedFile.startsWith(expectedPrefix)
  ) {
    json(res, 400, { error: "invalid_job_path" });
    return;
  }

  try {
    const body = await readFile(filePath, "utf8");
    JSON.parse(body);
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "content-length": Buffer.byteLength(body),
      "cache-control": "no-store",
    });
    res.end(body);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      json(res, 404, { error: "deliverable_not_found", job_id: jobId });
      return;
    }
    json(res, 500, {
      error: "deliverable_read_failed",
      job_id: jobId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  console.log(`[spondee-deliverable-server] serving ${storageRoot} on http://${host}:${port}/erc8183`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
