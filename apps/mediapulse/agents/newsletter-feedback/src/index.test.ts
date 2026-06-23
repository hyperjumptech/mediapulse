/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/agent-auth-client", () => ({
  verifyTokenViaAuthApi: vi.fn().mockResolvedValue(true),
}));

vi.mock("@mediapulse/env/agents-newsletter-feedback", () => ({
  env: {
    AGENT_DATA_API_URL: "http://data-api.example.com",
    AGENT_AUTH_API_URL: "http://auth.example.com",
    PORT: undefined,
    AGENT_REGISTRY_URL: undefined,
    AGENT_PUBLIC_URL: undefined,
    DOMAIN_INTEGRATION_API_KEY: undefined,
    DOMAIN_INTEGRATION_ID: undefined,
  },
}));

import app from "./index";

describe("newsletter-feedback agent", () => {
  it("GET /schemas returns 200", async () => {
    const res = await app.fetch(new Request("http://localhost/schemas"));

    expect(res.status).toBe(200);
  });
});
