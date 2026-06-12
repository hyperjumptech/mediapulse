/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

const runtimeConfig = {
  agentDataApiUrl: "http://test-agent-data-api",
  agentAuthApiUrl: "http://test-agent-auth-api",
  internalApiKey: "test-key",
  cgaDiagnosticsEnabled: true,
};

vi.mock("@/lib/mediapulse-hermes-dashboard-config", () => ({
  getMediapulseHermesDashboardRuntimeConfig: () => runtimeConfig,
}));

vi.mock("@mediapulse/hermes-dashboard", () => ({
  getContentGenerationRunById: vi.fn(),
}));

import { GET } from "./route";
import { getContentGenerationRunById } from "@mediapulse/hermes-dashboard";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const run = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  agentId: "content-generation",
  agentVersion: "1.0.0",
  tickerId: "ticker-1",
  outcome: "failed" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("GET /api/agents/content-generation-runs/[id]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(
      new Request("http://localhost/api/agents/content-generation-runs/x"),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when run is missing", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      },
      apiKeyId: "k1",
      readOnly: false,
      label: "k",
    });
    vi.mocked(getContentGenerationRunById).mockResolvedValue(null);
    const res = await GET(
      new Request(
        `http://localhost/api/agents/content-generation-runs/${run.id}`,
      ),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns run detail for api key", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      },
      apiKeyId: "k1",
      readOnly: false,
      label: "k",
    });
    vi.mocked(getContentGenerationRunById).mockResolvedValue(run);
    const res = await GET(
      new Request(
        `http://localhost/api/agents/content-generation-runs/${run.id}`,
        { headers: { Authorization: "Bearer hmcp_ok" } },
      ),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(getContentGenerationRunById).toHaveBeenCalledWith(
      run.id,
      runtimeConfig,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ item: run });
  });
});
