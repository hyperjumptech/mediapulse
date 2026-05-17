/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardReadOnlyApiKeyError } from "@/lib/dashboard-read-only-api-key-error";

vi.mock("@/lib/auth-dashboard", () => ({
  requireDashboardPrincipalForRoute: vi.fn(),
  resolveDashboardPrincipal: vi.fn(),
}));

import {
  requireDashboardPrincipalForRoute,
  resolveDashboardPrincipal,
} from "@/lib/auth-dashboard";
import { requireMutationDashboardPrincipalForRoute } from "@/lib/require-mutation-dashboard-principal-for-route";

const sessionUser = {
  id: "user-1",
  name: "Admin",
  email: "admin@test.com",
  credentialVersion: 0,
};

describe("requireMutationDashboardPrincipalForRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("delegates to session auth when request is omitted", async () => {
    // Setup
    vi.mocked(requireDashboardPrincipalForRoute).mockResolvedValue(sessionUser);

    // Act
    const user = await requireMutationDashboardPrincipalForRoute();

    // Assert
    expect(user).toEqual(sessionUser);
    expect(requireDashboardPrincipalForRoute).toHaveBeenCalledOnce();
    expect(resolveDashboardPrincipal).not.toHaveBeenCalled();
  });

  it("returns user for full-access API key principals", async () => {
    // Setup
    const request = new Request(
      "http://localhost/dashboard/agents/actions/create",
      {
        headers: { Authorization: "Bearer hmcp_test" },
      },
    );
    vi.mocked(resolveDashboardPrincipal).mockResolvedValue({
      authMethod: "api_key",
      user: sessionUser,
      apiKeyId: "key-1",
      readOnly: false,
      label: "full",
    });

    // Act
    const user = await requireMutationDashboardPrincipalForRoute(request);

    // Assert
    expect(user).toEqual(sessionUser);
  });

  it("throws DashboardReadOnlyApiKeyError for read-only API keys", async () => {
    // Setup
    const request = new Request(
      "http://localhost/dashboard/agents/actions/create",
      {
        headers: { Authorization: "Bearer hmcp_ro" },
      },
    );
    vi.mocked(resolveDashboardPrincipal).mockResolvedValue({
      authMethod: "api_key",
      user: sessionUser,
      apiKeyId: "key-ro",
      readOnly: true,
      label: "read-only",
    });

    // Act / Assert
    await expect(
      requireMutationDashboardPrincipalForRoute(request),
    ).rejects.toBeInstanceOf(DashboardReadOnlyApiKeyError);
  });

  it("throws when principal resolution fails", async () => {
    // Setup
    const request = new Request(
      "http://localhost/dashboard/agents/actions/create",
    );
    vi.mocked(resolveDashboardPrincipal).mockResolvedValue(null);

    // Act / Assert
    await expect(
      requireMutationDashboardPrincipalForRoute(request),
    ).rejects.toThrow("Unauthorized");
  });
});
