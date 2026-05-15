/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-dashboard", () => ({
  DASHBOARD_UNAUTHORIZED_BODY: { error: "Unauthorized" },
  resolveDashboardPrincipal: vi.fn(),
}));

import { resolveDashboardPrincipal } from "@/lib/auth-dashboard";
import { GET } from "./route";

describe("GET /api/mcp/whoami", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipal).mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/mcp/whoami"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for session-only principal", async () => {
    vi.mocked(resolveDashboardPrincipal).mockResolvedValue({
      authMethod: "session",
      user: {
        id: "u1",
        name: "A",
        email: "a@b.com",
        credentialVersion: 0,
      },
    });
    const res = await GET(new Request("http://localhost/api/mcp/whoami"));
    expect(res.status).toBe(401);
  });

  it("returns key metadata for api_key principal", async () => {
    vi.mocked(resolveDashboardPrincipal).mockResolvedValue({
      authMethod: "api_key",
      user: {
        id: "u1",
        name: "Admin",
        email: "admin@test.com",
        credentialVersion: 0,
      },
      apiKeyId: "key-1",
      readOnly: false,
      label: "Cursor",
    });
    const res = await GET(
      new Request("http://localhost/api/mcp/whoami", {
        headers: { Authorization: "Bearer hmcp_ok" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      label: "Cursor",
      readOnly: false,
      keyId: "key-1",
      user: { id: "u1", email: "admin@test.com", name: "Admin" },
    });
    expect(JSON.stringify(body)).not.toContain("hmcp_ok");
  });
});
