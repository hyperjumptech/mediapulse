/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerById: vi.fn(),
}));

import { GET } from "./route";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";
import { getHttpTriggerById } from "@/lib/http-triggers";

const triggerId = "00000000-0000-4000-8000-000000000001";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const callRoute = () =>
  GET(new Request(`http://localhost/api/http-triggers/${triggerId}`), {
    params: Promise.resolve({ triggerId }),
  });

describe("GET /api/http-triggers/[triggerId]", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 401 without a principal and skips the lookup", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await callRoute();

    expect(response.status).toBe(401);
    expect(getHttpTriggerById).not.toHaveBeenCalled();
  });

  it("returns 404 when the trigger does not exist", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getHttpTriggerById).mockResolvedValue(null);

    const response = await callRoute();

    expect(response.status).toBe(404);
  });

  it("returns the trigger with its pipeline", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getHttpTriggerById).mockResolvedValue({
      id: triggerId,
      name: "Day one",
      authType: "DOMAIN_EVENT",
      eventName: "day.start",
      pipeline: { id: "p1", name: "Collect" },
    } as never);

    const response = await callRoute();
    const body = await response.json();

    expect(getHttpTriggerById).toHaveBeenCalledWith(triggerId);
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: triggerId,
      eventName: "day.start",
      pipeline: { name: "Collect" },
    });
  });
});
