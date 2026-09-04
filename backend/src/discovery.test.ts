import assert from "node:assert/strict";
import test from "node:test";
import { clearDiscoveryCacheForTests, discover8004scanAgents } from "./discovery.js";

test("8004scan discovery normalizes identity without inferring activation or performance", async () => {
  clearDiscoveryCacheForTests();
  const calls: Array<{ url: string; apiKey: string | null }> = [];
  const fetchFn: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      apiKey: new Headers(init?.headers).get("X-API-Key"),
    });
    return new Response(JSON.stringify({
      agents: [
        {
          chain_id: 56,
          token_id: 171927,
          name: "Example BSC Agent",
          description: "external",
          owner_address: "0x1111111111111111111111111111111111111111",
          active: true,
          services: [{ name: "A2A", endpoint: "https://agent.example" }],
        },
        { chain_id: 8453, token_id: 99, name: "Wrong chain" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await discover8004scanAgents(
    { search: "yield", chainId: 56, limit: 10 },
    {
      SPONDEE_8004SCAN_API_BASE_URL: "https://api.example/api/v1/",
      SPONDEE_8004SCAN_API_KEY: "server-secret",
      SPONDEE_8004SCAN_CACHE_SECONDS: "60",
    },
    fetchFn,
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /chain_id=56/);
  assert.match(calls[0]!.url, /search=yield/);
  assert.equal(calls[0]!.apiKey, "server-secret");
  assert.equal(result.agents.length, 1);
  assert.equal(result.agents[0]!.registry_agent_id, "171927");
  assert.equal(result.agents[0]!.activatable, false);
  assert.equal(result.performance_claims_inferred, false);
  assert.equal(result.activation_claims_inferred, false);

  const cached = await discover8004scanAgents(
    { search: "yield", chainId: 56, limit: 10 },
    {
      SPONDEE_8004SCAN_API_BASE_URL: "https://api.example/api/v1/",
      SPONDEE_8004SCAN_API_KEY: "server-secret",
      SPONDEE_8004SCAN_CACHE_SECONDS: "60",
    },
    fetchFn,
  );
  assert.equal(cached.cached, true);
  assert.equal(calls.length, 1);
});

test("8004scan discovery fails closed on upstream error", async () => {
  clearDiscoveryCacheForTests();
  const fetchFn: typeof fetch = async () => new Response("rate limited", { status: 429 });
  await assert.rejects(
    () => discover8004scanAgents({ chainId: 56 }, { SPONDEE_8004SCAN_CACHE_SECONDS: "0" }, fetchFn),
    /8004scan discovery HTTP 429/,
  );
});
