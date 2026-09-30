/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/overview-api", () => ({
  getOverviewForApi: vi.fn(),
}));

import { GET } from "./route";
import { getOverviewForApi } from "@/lib/overview-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

describe("GET /api/overview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await GET(new Request("http://localhost/api/overview"));

    expect(response.status).toBe(401);
  });

  it("clamps days and passes the time zone through", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getOverviewForApi).mockResolvedValue({ daily: [] } as never);

    const response = await GET(
      new Request(
        "http://localhost/api/overview?days=365&timeZone=Asia%2FJakarta",
      ),
    );

    expect(response.status).toBe(200);
    expect(getOverviewForApi).toHaveBeenCalledWith(
      expect.objectContaining({ days: 90, timeZone: "Asia/Jakarta" }),
    );
  });

  it("rejects an unknown time zone", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );

    const response = await GET(
      new Request("http://localhost/api/overview?timeZone=Mars%2FBase"),
    );

    expect(response.status).toBe(400);
    expect(getOverviewForApi).not.toHaveBeenCalled();
  });
});
