/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/schedules", () => ({
  getScheduleById: vi.fn(),
}));

import { GET } from "./route";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { getScheduleById } from "@/lib/schedules";

const scheduleId = "00000000-0000-4000-8000-000000000001";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const callRoute = () =>
  GET(new Request(`http://localhost/api/schedules/${scheduleId}`), {
    params: Promise.resolve({ scheduleId }),
  });

describe("GET /api/schedules/[scheduleId]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without a principal and skips the lookup", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(getScheduleById).not.toHaveBeenCalled();
  });

  it("returns 404 when the schedule does not exist", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getScheduleById).mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(404);
  });

  it("returns the schedule with its pipeline", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getScheduleById).mockResolvedValue({
      id: scheduleId,
      name: "Nightly",
      cronExpression: "0 2 * * *",
      pipeline: { id: "p1", name: "Collect" },
    } as never);

    const response = await callRoute();
    const body = await response.json();

    expect(getScheduleById).toHaveBeenCalledWith(scheduleId);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: scheduleId,
      cronExpression: "0 2 * * *",
      pipeline: { name: "Collect" },
    });
  });
});
