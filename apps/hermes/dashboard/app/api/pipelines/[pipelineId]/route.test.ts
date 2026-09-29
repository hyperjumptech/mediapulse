/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/pipelines", () => ({
  getPipelineWithSteps: vi.fn(),
}));

import { GET } from "./route";
import { getPipelineWithSteps } from "@/lib/pipelines";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const pipelineId = "00000000-0000-4000-8000-000000000001";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: {
    id: "u1",
    name: "A",
    email: "a@b.com",
    credentialVersion: 0,
  },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const callRoute = (id: string) =>
  GET(new Request(`http://localhost/api/pipelines/${id}`), {
    params: Promise.resolve({ pipelineId: id }),
  });

describe("GET /api/pipelines/[pipelineId]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal and skips the lookup", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await callRoute(pipelineId);

    expect(res.status).toBe(401);
    expect(getPipelineWithSteps).not.toHaveBeenCalled();
  });

  it("returns 404 when the pipeline does not exist", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getPipelineWithSteps).mockResolvedValue(null);

    const res = await callRoute(pipelineId);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Pipeline not found" });
  });

  it("returns the pipeline with ordered steps", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    vi.mocked(getPipelineWithSteps).mockResolvedValue({
      id: pipelineId,
      name: "Daily",
      description: null,
      timeout: null,
      isActive: true,
      executionConfig: null,
      domainIntegrationId: "di-1",
      createdAt,
      updatedAt: createdAt,
      createdById: null,
      createdBy: null,
      steps: [
        {
          id: "s1",
          order: 0,
          kind: "agent",
          agentId: "collector",
          agentVersion: "1",
          targetPipelineId: null,
          targetPipeline: null,
          pipelineId,
          agentConfigId: null,
          agentContractId: null,
          input: { query: "x" },
          config: {},
          createdAt,
          updatedAt: createdAt,
          createdById: null,
        },
      ],
    });

    const res = await callRoute(pipelineId);

    expect(getPipelineWithSteps).toHaveBeenCalledWith(pipelineId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      steps: Array<{ agentId: string; input: unknown }>;
    };
    expect(body.id).toBe(pipelineId);
    expect(body.steps).toEqual([
      expect.objectContaining({ agentId: "collector", input: { query: "x" } }),
    ]);
  });
});
