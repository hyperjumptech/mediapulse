/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/schedules", () => ({
  getSchedulesPage: vi.fn(),
}));

import { GET } from "./route";
import { getSchedulesPage } from "@/lib/schedules";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const principal = {
  authMethod: "session" as const,
  user: {
    id: "u1",
    name: "Admin",
    email: "admin@test.com",
    credentialVersion: 0,
  },
};

describe("GET /api/schedules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(new Request("http://localhost/api/schedules"));
    expect(res.status).toBe(401);
  });

  it("returns empty list", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      principal,
    );
    vi.mocked(getSchedulesPage).mockResolvedValue({
      schedules: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/schedules"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it("returns schedules for authenticated principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      principal,
    );
    vi.mocked(getSchedulesPage).mockResolvedValue({
      schedules: [{ id: "sched-1", name: "Daily" }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const res = await GET(new Request("http://localhost/api/schedules"));
    expect(getSchedulesPage).toHaveBeenCalledWith(1, 20);
    expect(res.status).toBe(200);
  });
});
