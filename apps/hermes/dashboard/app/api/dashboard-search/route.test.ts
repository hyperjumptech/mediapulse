/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-dashboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-dashboard")>();

  return { ...actual, getDashboardPrincipalUser: vi.fn() };
});

vi.mock("@/lib/dashboard-search", () => ({
  searchDashboardEntities: vi.fn(),
}));

import { getDashboardPrincipalUser } from "@/lib/auth-dashboard";
import { searchDashboardEntities } from "@/lib/dashboard-search";

import { GET } from "./route";

const authenticatedUser = {
  id: "user-1",
  name: "Admin",
  email: "admin@example.com",
  credentialVersion: 0,
};

const createSearchRequest = (search: string) =>
  new Request(`http://localhost/api/dashboard-search${search}`);

describe("GET /api/dashboard-search", () => {
  afterEach(() => {
    vi.mocked(getDashboardPrincipalUser).mockReset();
    vi.mocked(searchDashboardEntities).mockReset();
  });

  it("returns 401 without searching when the caller is not authenticated", async () => {
    // Setup
    vi.mocked(getDashboardPrincipalUser).mockResolvedValue(null);
    const request = createSearchRequest("?q=daily");

    // Act
    const response = await GET(request);

    // Assert
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(getDashboardPrincipalUser).toHaveBeenCalledWith(request);
    expect(searchDashboardEntities).not.toHaveBeenCalled();
  });

  it("returns 400 without searching when the query is longer than 100 characters", async () => {
    // Setup
    vi.mocked(getDashboardPrincipalUser).mockResolvedValue(authenticatedUser);
    const longQuery = "a".repeat(101);

    // Act
    const response = await GET(createSearchRequest(`?q=${longQuery}`));

    // Assert
    expect(response.status).toBe(400);

    const body = (await response.json()) as {
      error: string;
      issues: Record<string, string[]>;
    };

    expect(body.error).toBe("Invalid search query");
    expect(body.issues.q).toHaveLength(1);
    expect(searchDashboardEntities).not.toHaveBeenCalled();
  });

  it("accepts a query of exactly 100 characters", async () => {
    // Setup
    vi.mocked(getDashboardPrincipalUser).mockResolvedValue(authenticatedUser);
    vi.mocked(searchDashboardEntities).mockResolvedValue([]);
    const maximumQuery = "a".repeat(100);

    // Act
    const response = await GET(createSearchRequest(`?q=${maximumQuery}`));

    // Assert
    expect(response.status).toBe(200);
    expect(searchDashboardEntities).toHaveBeenCalledWith(maximumQuery);
  });

  it("returns the search results for the decoded query", async () => {
    // Setup
    vi.mocked(getDashboardPrincipalUser).mockResolvedValue(authenticatedUser);
    const results = [
      {
        type: "pipeline" as const,
        id: "pipeline-1",
        label: "Daily digest",
        href: "/dashboard/pipelines/pipeline-1",
      },
      {
        type: "variable" as const,
        id: "variable-1",
        label: "DAILY_LIMIT",
        description: "Max items",
        href: "/dashboard/variables?q=DAILY_LIMIT",
      },
    ];
    vi.mocked(searchDashboardEntities).mockResolvedValue(results);

    // Act
    const response = await GET(createSearchRequest("?q=daily%20digest"));

    // Assert
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results });
    expect(searchDashboardEntities).toHaveBeenCalledWith("daily digest");
  });

  it("searches with an empty query when q is missing", async () => {
    // Setup
    vi.mocked(getDashboardPrincipalUser).mockResolvedValue(authenticatedUser);
    vi.mocked(searchDashboardEntities).mockResolvedValue([]);

    // Act
    const response = await GET(createSearchRequest(""));

    // Assert
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ results: [] });
    expect(searchDashboardEntities).toHaveBeenCalledWith("");
  });
});
