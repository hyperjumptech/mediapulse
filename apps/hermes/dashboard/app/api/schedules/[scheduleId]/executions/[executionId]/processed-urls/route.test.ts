/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/require-dashboard-principal-response", () => ({
  resolveDashboardPrincipalOrUnauthorized: vi.fn(),
}));

vi.mock("@/lib/processed-urls-api", () => ({
  getProcessedUrlsForApi: vi.fn(),
}));

import { GET } from "./route";
import { getProcessedUrlsForApi } from "@/lib/processed-urls-api";
import { resolveDashboardPrincipalOrUnauthorized } from "@/lib/require-dashboard-principal-response";

const apiKeyPrincipal = {
  authMethod: "api_key" as const,
  user: { id: "u1", name: "A", email: "a@b.com", credentialVersion: 0 },
  apiKeyId: "k1",
  readOnly: true,
  label: "k",
};

const callRoute = (query: string) =>
  GET(new Request(`http://localhost/processed-urls${query}`), {
    params: Promise.resolve({ scheduleId: "s1", executionId: "e1" }),
  });

describe("GET processed URLs of a schedule execution", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("forwards filters and pages the domain response", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getProcessedUrlsForApi).mockResolvedValue({
      items: [],
      total: 120,
      page: 1,
      pageSize: 50,
    });

    const response = await callRoute("?status=dropped&agent=collector");
    const body = await response.json();

    expect(getProcessedUrlsForApi).toHaveBeenCalledWith({
      scheduleId: "s1",
      executionId: "e1",
      page: 1,
      pageSize: 50,
      subjectId: undefined,
      agent: "collector",
      status: "dropped",
      gateStatus: undefined,
    });
    expect(body).toMatchObject({ total: 120, hasMore: true });
  });

  it("returns 404 when the execution is not part of the schedule", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getProcessedUrlsForApi).mockResolvedValue(null);

    const response = await callRoute("");

    expect(response.status).toBe(404);
  });

  it("reports a domain failure as a bad gateway", async () => {
    vi.mocked(resolveDashboardPrincipalOrUnauthorized).mockResolvedValue(
      apiKeyPrincipal,
    );
    vi.mocked(getProcessedUrlsForApi).mockRejectedValue(new Error("boom"));

    const response = await callRoute("");

    expect(response.status).toBe(502);
  });
});
