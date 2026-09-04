import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { authorizeProtectedScope, backendDeploymentReadiness } from "./security.js";

function requestWithAuthorization(value?: string): Request {
  return {
    header(name: string) {
      return name.toLowerCase() === "authorization" ? value : undefined;
    },
  } as Request;
}

test("protected scope fails closed when server token is absent", () => {
  const result = authorizeProtectedScope(requestWithAuthorization("Bearer anything"), "ACTION", {});
  assert.deepEqual(result, {
    ok: false,
    status: 503,
    error: "action protection is not configured",
  });
});

test("protected scope requires and verifies bearer token", () => {
  const env = { SPONDEE_ACTION_TOKEN: "a-very-long-action-token-123456789" };
  assert.equal(authorizeProtectedScope(requestWithAuthorization(), "ACTION", env).ok, false);
  assert.equal(authorizeProtectedScope(requestWithAuthorization("Bearer wrong"), "ACTION", env).ok, false);
  assert.deepEqual(
    authorizeProtectedScope(
      requestWithAuthorization("Bearer a-very-long-action-token-123456789"),
      "ACTION",
      env,
    ),
    { ok: true },
  );
});

test("backend deployment readiness distinguishes code completeness from env readiness", () => {
  const incomplete = backendDeploymentReadiness({});
  assert.equal(incomplete.backend_code_status, "COMPLETE_FOR_FRONTEND_V1");
  assert.equal(incomplete.public_deployment_ready, false);
  assert.ok(incomplete.blocking_configuration.includes("DATABASE_URL_NOT_CONFIGURED"));

  const ready = backendDeploymentReadiness({
    DATABASE_URL: "postgresql://example",
    SPONDEE_CORS_ORIGINS: "https://frontend.example",
    SPONDEE_ACTION_TOKEN: "action-token-long-enough-123456",
    SPONDEE_EVIDENCE_INGEST_TOKEN: "evidence-token-long-enough-1234",
  });
  assert.equal(ready.public_deployment_ready, true);
  assert.deepEqual(ready.blocking_configuration, []);
  assert.equal(ready.external_discovery.browser_key_exposure_required, false);
});
