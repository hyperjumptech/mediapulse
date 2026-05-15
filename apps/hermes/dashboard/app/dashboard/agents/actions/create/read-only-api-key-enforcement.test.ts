/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardReadOnlyApiKeyError } from "@/lib/dashboard-read-only-api-key-error";

vi.mock("@/lib/require-mutation-dashboard-principal-for-route", () => ({
  requireMutationDashboardPrincipalForRoute: vi.fn(),
}));

vi.mock("@hermes/orchestration-database", () => ({
  prisma: {
    agentRegistry: { create: vi.fn() },
    domainIntegration: { findUnique: vi.fn() },
  },
}));

import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";
import { POST } from "./route";

describe("create agent route read-only API key enforcement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 403 with read_only_key when mutation principal rejects read-only keys", async () => {
    // Setup
    vi.mocked(requireMutationDashboardPrincipalForRoute).mockRejectedValue(
      new DashboardReadOnlyApiKeyError(),
    );

    // Act
    const response = await POST(
      new Request("http://localhost/dashboard/agents/actions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "agent-1",
          agentVersion: "1.0.0",
          domainIntegrationId: "int-1",
        }),
      }),
    );

    // Assert
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: "read_only_key",
      message: "Read-only API key cannot call mutation routes",
    });
  });
});
