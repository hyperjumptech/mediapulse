/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/agents-knowledge-ingestion", () => ({
  env: {
    PORT: 4013,
    AGENT_DATA_API_URL: "http://localhost:8081",
    AGENT_AUTH_API_URL: "http://localhost:8080",
    AGENT_REGISTRY_URL: "http://localhost:8082",
    AGENT_PUBLIC_URL: "http://localhost:4013",
    DOMAIN_INTEGRATION_API_KEY: "test-key",
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
import { createAgentApp } from "@workspace/agent-runtime";
import { z } from "zod";

import { AGENT_ID, AGENT_VERSION } from "./agent-version.js";
import { run } from "./run.js";

const InputSchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.number().int().positive().max(20000).optional(),
});

const ConfigSchema = z.object({
  dryRun: z.boolean().optional(),
});

type Input = z.infer<typeof InputSchema>;
type Config = z.infer<typeof ConfigSchema>;

const buildApp = () =>
  createAgentApp<Input, typeof InputSchema, Config, typeof ConfigSchema>(
    {
      agentId: AGENT_ID,
      agentVersion: AGENT_VERSION,
      inputSchema: InputSchema,
      configSchema: ConfigSchema,
      run,
    },
    { verifyToken: async () => true },
  );

describe("knowledge-ingestion agent", () => {
  it("serves GET /health without an Authorization header", async () => {
    const app = buildApp();
    const response = await app.request("http://localhost/health", {
      method: "GET",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: AGENT_ID,
      version: AGENT_VERSION,
    });
  });

  it("publishes its input and config schemas", async () => {
    const app = buildApp();
    const response = await app.request("http://localhost/schemas", {
      method: "GET",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveProperty("inputSchema");
    expect(body).toHaveProperty("configSchema");
  });

  it("rejects an unauthenticated invocation", async () => {
    const app = buildApp();
    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: {}, config: {} }),
    });

    expect(response.status).toBe(401);
  });
});
