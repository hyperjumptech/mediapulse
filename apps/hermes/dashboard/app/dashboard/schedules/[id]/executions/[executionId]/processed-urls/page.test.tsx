import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const withDashboardAdminMock = vi.fn();
const fetchProcessedUrlsForExecutionMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: (load: Promise<unknown>) => withDashboardAdminMock(load),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  fetchProcessedUrlsForExecution: (...args: unknown[]) =>
    fetchProcessedUrlsForExecutionMock(...args),
}));

import ProcessedUrlsPage from "./page";

const renderPage = async (searchParams: Record<string, string> = {}) => {
  render(
    await ProcessedUrlsPage({
      params: Promise.resolve({ id: "schedule-1", executionId: "execution-1" }),
      searchParams: Promise.resolve(searchParams),
    }),
  );
};

describe("ProcessedUrlsPage", () => {
  afterEach(() => {
    withDashboardAdminMock.mockReset();
    fetchProcessedUrlsForExecutionMock.mockReset();
  });

  it("loads processed URLs with the parsed filters and renders them", async () => {
    // Setup
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [
        {
          id: "outcome-1",
          tickerSymbol: "ACME",
          agent: "data-collection",
          url: "https://example.com/article",
          status: "collected",
          gateStatus: "passed",
          reason: null,
          reasonDetail: null,
          source: null,
          curatedSourceId: null,
          curatedSourceName: null,
          curatedSourceListingUrl: null,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      total: 1,
      page: 2,
      pageSize: 50,
    });

    // Act
    await renderPage({ page: "2", agent: "data-collection" });

    // Assert
    expect(fetchProcessedUrlsForExecutionMock).toHaveBeenCalledWith({
      scheduleExecutionId: "execution-1",
      page: 2,
      pageSize: 50,
      tickerId: undefined,
      agent: "data-collection",
      status: undefined,
      gateStatus: undefined,
    });
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/article")).toBeInTheDocument();
  });

  it("shows the load error inline when the domain request fails", async () => {
    // Setup
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockRejectedValue(
      new Error("domain-api unavailable"),
    );

    // Act
    await renderPage();

    // Assert
    expect(screen.getByText("domain-api unavailable")).toBeInTheDocument();
  });

  it("rejects instead of rendering when the admin check fails", async () => {
    // Setup
    withDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    // Act
    const pending = renderPage();

    // Assert
    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
  });
});
