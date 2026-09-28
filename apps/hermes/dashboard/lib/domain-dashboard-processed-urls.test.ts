/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchProcessedUrlsForExecution } from "./domain-dashboard";

const getDomainIntegrationByIntegrationId = vi.fn();

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: (...args: unknown[]) =>
    getDomainIntegrationByIntegrationId(...args),
}));

vi.mock("@/lib/domain-integration-auth-token", () => ({
  getBearerJwtForDomainIntegrationId: vi.fn().mockResolvedValue("test-jwt"),
  invalidateDomainIntegrationToken: vi.fn(),
}));

const integrationRecord = {
  id: "record-a",
  integrationId: "integration-a",
  name: "Integration A",
  baseUrl: "http://domain.test/",
  version: "1",
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  capabilities: [],
  dashboard: { templateVersion: 1, views: [] },
};

const processedUrlItem = {
  id: "outcome-1",
  agent: "collector",
  url: "https://example.com/article",
  status: "collected",
  reason: null,
  reasonDetail: null,
  source: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const stubDomainResponse = (payload: unknown) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
};

const requestedUrl = (fetchMock: ReturnType<typeof vi.fn>): URL =>
  new URL(String(fetchMock.mock.calls[0]?.[0]));

describe("fetchProcessedUrlsForExecution", () => {
  beforeEach(() => {
    getDomainIntegrationByIntegrationId.mockReset();
    getDomainIntegrationByIntegrationId.mockResolvedValue(integrationRecord);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the given integration with generic filter params", async () => {
    const fetchMock = stubDomainResponse({
      items: [],
      total: 0,
      page: 2,
      pageSize: 25,
    });

    await fetchProcessedUrlsForExecution({
      integrationId: "integration-a",
      scheduleExecutionId: "execution-1",
      page: 2,
      pageSize: 25,
      subjectId: "subject-1",
      agent: "collector",
      status: undefined,
      gateStatus: "failed",
    });

    const url = requestedUrl(fetchMock);

    expect(getDomainIntegrationByIntegrationId).toHaveBeenCalledWith(
      "integration-a",
    );
    expect(url.origin + url.pathname).toBe(
      "http://domain.test/v1/hermes-dashboard/processed-urls",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      scheduleExecutionId: "execution-1",
      page: "2",
      pageSize: "25",
      subjectId: "subject-1",
      agent: "collector",
      gateStatus: "failed",
    });
  });

  it("parses the subject and the subject title", async () => {
    stubDomainResponse({
      items: [
        {
          ...processedUrlItem,
          subject: { id: "subject-1", label: "ACME" },
          legacyField: "ignored",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
      subjectTitle: "Account",
    });

    const response = await fetchProcessedUrlsForExecution({
      integrationId: "integration-a",
      scheduleExecutionId: "execution-1",
      page: 1,
      pageSize: 50,
    });

    expect(response.subjectTitle).toBe("Account");
    expect(response.items).toEqual([
      { ...processedUrlItem, subject: { id: "subject-1", label: "ACME" } },
    ]);
  });

  it("accepts a response from a domain that predates subjects", async () => {
    stubDomainResponse({
      items: [processedUrlItem],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    const response = await fetchProcessedUrlsForExecution({
      integrationId: "integration-a",
      scheduleExecutionId: "execution-1",
      page: 1,
      pageSize: 50,
    });

    expect(response.subjectTitle).toBeUndefined();
    expect(response.items[0]?.subject).toBeUndefined();
  });

  it("drops a malformed subject or subject title instead of failing", async () => {
    stubDomainResponse({
      items: [{ ...processedUrlItem, subject: "ACME" }],
      total: 1,
      page: 1,
      pageSize: 50,
      subjectTitle: 42,
    });

    const response = await fetchProcessedUrlsForExecution({
      integrationId: "integration-a",
      scheduleExecutionId: "execution-1",
      page: 1,
      pageSize: 50,
    });

    expect(response.subjectTitle).toBeUndefined();
    expect(response.items[0]?.subject).toBeUndefined();
    expect(response.items[0]?.url).toBe("https://example.com/article");
  });

  it("rejects a response without the list envelope", async () => {
    stubDomainResponse({ items: "none" });

    const request = fetchProcessedUrlsForExecution({
      integrationId: "integration-a",
      scheduleExecutionId: "execution-1",
      page: 1,
      pageSize: 50,
    });

    await expect(request).rejects.toThrow(
      "Invalid processed-urls response shape",
    );
  });

  it("reports an integration that is not active", async () => {
    getDomainIntegrationByIntegrationId.mockResolvedValue(null);
    const fetchMock = stubDomainResponse({});

    const request = fetchProcessedUrlsForExecution({
      integrationId: "integration-b",
      scheduleExecutionId: "execution-1",
      page: 1,
      pageSize: 50,
    });

    await expect(request).rejects.toThrow(
      'Domain integration "integration-b" is not active or not registered',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
