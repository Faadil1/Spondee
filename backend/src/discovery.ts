export interface DiscoveredAgent {
  source: "8004SCAN";
  activatable: false;
  chain_id: number;
  registry_agent_id: string;
  name: string;
  description: string;
  owner_address: string | null;
  agent_uri: string | null;
  image: string | null;
  active: boolean | null;
  services: unknown[];
  raw_identity_ref: {
    chain_id: number;
    token_id: string;
  };
  claim_guardrail: string;
}

export interface DiscoveryResult {
  schema: "spondee.8004scan-discovery.v1";
  source: "8004SCAN_OFFICIAL_API";
  fetched_at: string;
  cached: boolean;
  query: {
    search: string | null;
    chain_id: number;
    limit: number;
  };
  agents: DiscoveredAgent[];
  performance_claims_inferred: false;
  activation_claims_inferred: false;
}

type FetchLike = typeof fetch;

interface CacheEntry {
  expiresAt: number;
  result: DiscoveryResult;
}

const cache = new Map<string, CacheEntry>();

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numberValue(obj: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  return fallback;
}

function arrayPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const obj = object(payload);
  if (!obj) return [];
  for (const key of ["agents", "items", "data", "results"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
    const nested = object(value);
    if (nested) {
      for (const nestedKey of ["agents", "items", "results"]) {
        if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[];
      }
    }
  }
  return [];
}

function normalizeAgent(value: unknown, defaultChainId: number): DiscoveredAgent | null {
  const obj = object(value);
  if (!obj) return null;
  const chainId = numberValue(obj, ["chain_id", "chainId"], defaultChainId);
  const tokenId = stringValue(obj, ["token_id", "tokenId", "agent_id", "agentId", "id"]);
  if (!tokenId) return null;
  const metadata = object(obj.metadata) ?? object(obj.registration) ?? {};
  const name = stringValue(obj, ["name", "agent_name"]) ?? stringValue(metadata, ["name"]) ?? `ERC-8004 Agent #${tokenId}`;
  const description = stringValue(obj, ["description"]) ?? stringValue(metadata, ["description"]) ?? "ERC-8004 agent discovered through 8004scan.";
  const servicesRaw = obj.services ?? metadata.services;
  const services = Array.isArray(servicesRaw) ? structuredClone(servicesRaw) : [];
  const activeRaw = obj.active ?? metadata.active;
  const active = typeof activeRaw === "boolean" ? activeRaw : null;

  return {
    source: "8004SCAN",
    activatable: false,
    chain_id: chainId,
    registry_agent_id: tokenId,
    name,
    description,
    owner_address: stringValue(obj, ["owner_address", "ownerAddress", "owner"]),
    agent_uri: stringValue(obj, ["agent_uri", "agentUri", "token_uri", "tokenURI"]),
    image: stringValue(obj, ["image"]) ?? stringValue(metadata, ["image"]),
    active,
    services,
    raw_identity_ref: { chain_id: chainId, token_id: tokenId },
    claim_guardrail:
      "Discovery metadata proves neither Spondee activation compatibility nor agent performance. External agents remain discovery-only until an adapter is independently verified.",
  };
}

export async function discover8004scanAgents(
  input: { search?: string | null; chainId?: number; limit?: number },
  env: NodeJS.ProcessEnv = process.env,
  fetchFn: FetchLike = fetch,
): Promise<DiscoveryResult> {
  const chainId = Number.isInteger(input.chainId) && (input.chainId ?? 0) > 0
    ? Number(input.chainId)
    : 56;
  const limit = Math.min(50, Math.max(1, Math.trunc(input.limit ?? 12)));
  const search = input.search?.trim().slice(0, 160) || null;
  const base = (env.SPONDEE_8004SCAN_API_BASE_URL?.trim() || "https://api.8004scan.io/api/v1").replace(/\/$/, "");
  const cacheSeconds = Math.min(600, Math.max(0, Number(env.SPONDEE_8004SCAN_CACHE_SECONDS ?? 60) || 60));
  const key = JSON.stringify({ base, chainId, limit, search });
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    return { ...structuredClone(hit.result), cached: true };
  }

  const url = new URL(`${base}/agents`);
  url.searchParams.set("chain_id", String(chainId));
  url.searchParams.set("limit", String(limit));
  if (search) url.searchParams.set("search", search);
  const headers: Record<string, string> = { accept: "application/json" };
  const apiKey = env.SPONDEE_8004SCAN_API_KEY?.trim();
  if (apiKey) headers["X-API-Key"] = apiKey;

  const response = await fetchFn(url, {
    headers,
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`8004scan discovery HTTP ${response.status}`);
  const payload = await response.json() as unknown;
  const agents = arrayPayload(payload)
    .map((entry) => normalizeAgent(entry, chainId))
    .filter((entry): entry is DiscoveredAgent => Boolean(entry))
    .filter((entry) => entry.chain_id === chainId)
    .slice(0, limit);

  const result: DiscoveryResult = {
    schema: "spondee.8004scan-discovery.v1",
    source: "8004SCAN_OFFICIAL_API",
    fetched_at: new Date().toISOString(),
    cached: false,
    query: { search, chain_id: chainId, limit },
    agents,
    performance_claims_inferred: false,
    activation_claims_inferred: false,
  };
  if (cacheSeconds > 0) cache.set(key, { expiresAt: now + cacheSeconds * 1000, result: structuredClone(result) });
  return result;
}

export function clearDiscoveryCacheForTests(): void {
  cache.clear();
}
