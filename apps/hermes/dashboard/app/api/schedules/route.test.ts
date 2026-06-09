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
import type { SchedulesPageResult } from "@/lib/schedules";
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
      schedules: [
        {
          id: "sched-1",
          name: "Daily",
          description: null,
          repeat: "repeating",
          cronExpression: null,
          interval: null,
          timezone: "America/New_York",
          startAt: null,
          nextRunAt: null,
          pipelineId: "p1",
          retryConfig: null,
          executionConfig: null,
          priority: 0,
          enabled: true,
          lastRecoveredAt: null,
          lastMissedRunCount: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          createdById: null,
          pipeline: { id: "p1", name: "Pipe" },
          createdBy: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    } satisfies SchedulesPageResult);
    const res = await GET(new Request("http://localhost/api/schedules"));
    expect(getSchedulesPage).toHaveBeenCalledWith(1, 20);
    expect(res.status).toBe(200);
  });
});
