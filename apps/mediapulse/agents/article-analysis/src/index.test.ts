/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/agents-article-analysis", () => ({
  env: {
    PORT: 4011,
    AGENT_DATA_API_URL: "http://localhost:8081",
    AGENT_AUTH_API_URL: "http://localhost:8080",
    ALLOW_ANY_BEARER_FOR_LOCAL: "false",
    AGENT_REGISTRY_URL: "http://localhost:8082",
    AGENT_PUBLIC_URL: "http://localhost:4011",
    DOMAIN_INTEGRATION_API_KEY: "test-domain-integration-key",
    DOMAIN_INTEGRATION_ID: "mediapulse",
  },
}));

import app from "./index";

describe("article-analysis agent", () => {
  it("GET /schemas returns 200", async () => {
    const res = await app.fetch(new Request("http://localhost/schemas"));
    expect(res.status).toBe(200);
  });
});
