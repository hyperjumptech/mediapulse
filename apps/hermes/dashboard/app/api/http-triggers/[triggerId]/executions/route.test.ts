/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/http-triggers", () => ({
  getHttpTriggerExecutionsPage: vi.fn(),
}));

import { GET } from "./route";
import { getHttpTriggerExecutionsPage } from "@/lib/http-triggers";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const parentId = "00000000-0000-4000-8000-000000000001";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const callRoute = (query: string) =>
  GET(new Request(`http://localhost/executions${query}`), {
    params: Promise.resolve({ triggerId: parentId }),
  });

describe("GET executions of one parent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without a principal", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const response = await callRoute("");

    expect(response.status).toBe(401);
    expect(getHttpTriggerExecutionsPage).not.toHaveBeenCalled();
  });

  it("pages executions newest first with hasMore", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getHttpTriggerExecutionsPage).mockResolvedValue({
      executions: [{ id: "e1" }],
      total: 11,
      page: 2,
      pageSize: 5,
    } as never);

    const response = await callRoute("?page=2&pageSize=5");
    const body = await response.json();

    expect(getHttpTriggerExecutionsPage).toHaveBeenCalledWith(parentId, 2, 5);
    expect(body).toEqual({
      items: [{ id: "e1" }],
      total: 11,
      page: 2,
      pageSize: 5,
      hasMore: true,
    });
  });
});
