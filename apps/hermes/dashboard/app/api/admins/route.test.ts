/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/hermes-admins-page", () => ({
  loadHermesAdminsForPage: vi.fn(),
}));

import { GET } from "./route";
import { loadHermesAdminsForPage } from "@/lib/hermes-admins-page";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

describe("GET list of admins", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await GET(new Request("http://localhost/list"));

    expect(response.status).toBe(401);
    expect(loadHermesAdminsForPage).not.toHaveBeenCalled();
  });

  it("returns every row", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue({
      authMethod: "api_key",
      user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
      apiKeyId: "k1",
      readOnly: true,
      label: "k",
    });
    vi.mocked(loadHermesAdminsForPage).mockResolvedValue([
      { id: "row-1" },
    ] as never);

    const response = await GET(new Request("http://localhost/list"));

    expect(await response.json()).toEqual({ admins: [{ id: "row-1" }] });
  });
});
