/** @vitest-environment node */

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { getAgentInsights } from "./agent-insights.js";

vi.mock("../services/agent-insights-registry.js", () => ({
  resolveInsightsProvider: vi.fn(),
}));

import { resolveInsightsProvider } from "../services/agent-insights-registry.js";

const VALID_PAYLOAD = {
  agentId: "page-collection",
  window: "7d",
  generatedAt: "2026-06-08T00:00:00.000Z",
  kpis: [{ id: "k1", label: "Articles", value: 42 }],
  alerts: [],
  sections: [
    {
      id: "s1",
      category: "what",
      title: "Article stat",
      widget: { kind: "stat", value: 42 },
    },
  ],
};

describe("getAgentInsights", () => {
  it("dispatches to the registered provider and returns the payload", async () => {
    vi.mocked(resolveInsightsProvider).mockReturnValue({
      agentId: "page-collection",
      compute: vi.fn().mockResolvedValue(VALID_PAYLOAD),
    });

    const app = new Hono();
    app.get("/", getAgentInsights);

    const response = await app.request("/?agentId=page-collection&window=7d");

    expect(response.status).toBe(200);
    const body = (await response.json()) as typeof VALID_PAYLOAD;
    expect(body.agentId).toBe("page-collection");
    expect(body.window).toBe("7d");
    expect(resolveInsightsProvider).toHaveBeenCalledWith("page-collection");
  });

  it("returns 404 when no provider is registered for agentId", async () => {
    vi.mocked(resolveInsightsProvider).mockReturnValue(undefined);

    const app = new Hono();
    app.get("/", getAgentInsights);

    const response = await app.request("/?agentId=unknown-agent&window=7d");

    expect(response.status).toBe(404);
  });

  it("returns 400 when the provider returns an invalid payload", async () => {
    vi.mocked(resolveInsightsProvider).mockReturnValue({
      agentId: "bad-provider",
      compute: vi.fn().mockResolvedValue({ invalid: true }),
    });

    const app = new Hono();
    app.get("/", getAgentInsights);

    const response = await app.request("/?agentId=bad-provider&window=7d");

    expect(response.status).toBe(400);
  });
});
