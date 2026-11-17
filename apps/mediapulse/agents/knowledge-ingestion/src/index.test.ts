/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/agents-knowledge-ingestion", () => ({
  env: {
    PORT: 4013,
    AGENT_DATA_API_URL: "http://localhost:8081",
    AGENT_AUTH_API_URL: "http://localhost:8080",
    AGENT_REGISTRY_URL: undefined,
    AGENT_PUBLIC_URL: undefined,
    DOMAIN_INTEGRATION_API_KEY: undefined,
    DOMAIN_INTEGRATION_ID: "mediapulse",
  },
}));

vi.mock("@workspace/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/logger")>();

  return {
    ...actual,
    logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  };
});

import { AGENT_ID, AGENT_VERSION } from "./agent-version.js";
import { app } from "./index.js";

describe("knowledge-ingestion agent", () => {
  it("serves GET /health without an Authorization header", async () => {
    const response = await app.request("http://localhost/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      service: AGENT_ID,
      version: AGENT_VERSION,
    });
  });

  it("publishes a config schema that requires the cutover", async () => {
    const response = await app.request("http://localhost/schemas");
    const body = (await response.json()) as {
      inputSchema: unknown;
      configSchema: { required: string[] };
    };

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("inputSchema");
    expect(body.configSchema.required).toContain("sendFrom");
  });

  it("rejects an unauthenticated invocation", async () => {
    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: {}, config: {} }),
    });

    expect(response.status).toBe(401);
  });
});
