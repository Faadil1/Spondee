import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

export type ProtectedScope = "ACTION" | "EVIDENCE_INGEST";

function configuredToken(scope: ProtectedScope, env: NodeJS.ProcessEnv): string {
  return (scope === "ACTION"
    ? env.SPONDEE_ACTION_TOKEN
    : env.SPONDEE_EVIDENCE_INGEST_TOKEN)?.trim() ?? "";
}

function bearerToken(req: Request): string {
  const header = req.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? "";
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

export function protectedScopeStatus(scope: ProtectedScope, env: NodeJS.ProcessEnv) {
  return {
    scope,
    configured: configuredToken(scope, env).length >= 24,
    minimum_length: 24,
    secret_exposed: false,
  } as const;
}

export function authorizeProtectedScope(
  req: Request,
  scope: ProtectedScope,
  env: NodeJS.ProcessEnv,
): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  const expected = configuredToken(scope, env);
  if (expected.length < 24) {
    return {
      ok: false,
      status: 503,
      error: `${scope.toLowerCase()} protection is not configured`,
    };
  }
  const supplied = bearerToken(req);
  if (!supplied) return { ok: false, status: 401, error: "missing bearer token" };
  const expectedDigest = digest(expected);
  const suppliedDigest = digest(supplied);
  return timingSafeEqual(expectedDigest, suppliedDigest)
    ? { ok: true }
    : { ok: false, status: 401, error: "invalid bearer token" };
}

export function backendDeploymentReadiness(env: NodeJS.ProcessEnv) {
  const corsOrigins = env.SPONDEE_CORS_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
  const action = protectedScopeStatus("ACTION", env);
  const evidence = protectedScopeStatus("EVIDENCE_INGEST", env);
  const durablePersistence = Boolean(env.DATABASE_URL?.trim());
  const corsConfigured = corsOrigins.length > 0;
  const externalDiscoveryBase = (
    env.SPONDEE_8004SCAN_API_BASE_URL?.trim() || "https://api.8004scan.io/api/v1"
  ).replace(/\/$/, "");

  const blocking = [
    !durablePersistence ? "DATABASE_URL_NOT_CONFIGURED" : null,
    !corsConfigured ? "SPONDEE_CORS_ORIGINS_NOT_CONFIGURED" : null,
    !action.configured ? "SPONDEE_ACTION_TOKEN_NOT_CONFIGURED" : null,
    !evidence.configured ? "SPONDEE_EVIDENCE_INGEST_TOKEN_NOT_CONFIGURED" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    schema: "spondee.backend-deployment-readiness.v1",
    backend_code_status: "COMPLETE_FOR_FRONTEND_V1" as const,
    public_deployment_ready: blocking.length === 0,
    blocking_configuration: blocking,
    durable_persistence_configured: durablePersistence,
    cors_origins_configured: corsConfigured,
    cors_origin_count: corsOrigins.length,
    action_scope_protected: action.configured,
    evidence_ingest_scope_protected: evidence.configured,
    external_discovery: {
      base_url: externalDiscoveryBase,
      api_key_configured: Boolean(env.SPONDEE_8004SCAN_API_KEY?.trim()),
      browser_key_exposure_required: false,
    },
    secrets_printed: false,
  } as const;
}
