import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProcessedUrlItem } from "@/lib/domain-dashboard";

const withDashboardAdminMock = vi.fn();
const fetchProcessedUrlsForExecutionMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: (load: Promise<unknown>) => withDashboardAdminMock(load),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  fetchProcessedUrlsForExecution: (...args: unknown[]) =>
    fetchProcessedUrlsForExecutionMock(...args),
}));

vi.mock("@/lib/data-table/read-column-visibility", () => ({
  readColumnVisibility: async () => ({ source: false }),
}));

import ProcessedUrlsPage from "./page";

const BASE_PATH =
  "/dashboard/schedules/schedule-1/executions/execution-1/processed-urls";

const processedUrl = (
  overrides: Partial<ProcessedUrlItem> = {},
): ProcessedUrlItem => ({
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
  ...overrides,
});

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
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl()],
      total: 1,
      page: 2,
      pageSize: 50,
    });

    await renderPage({ page: "2", agent: "data-collection" });

    expect(fetchProcessedUrlsForExecutionMock).toHaveBeenCalledWith({
      scheduleExecutionId: "execution-1",
      page: 2,
      pageSize: 50,
      tickerId: undefined,
      agent: "data-collection",
      status: undefined,
      gateStatus: undefined,
    });
    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(within(table).getByText("ACME")).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "https://example.com/article" }),
    ).toHaveAttribute("href", "https://example.com/article");
    expect(headers).toEqual([
      "Ticker",
      "Agent",
      "Status",
      "Reason",
      "URL",
      "Time",
    ]);
    expect(screen.queryByText(/Back to execution/)).not.toBeInTheDocument();
  });

  it("puts the filters on the table toolbar next to the column menu", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl()],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    await renderPage();

    const filters = screen.getByRole("navigation", {
      name: "Filter processed URLs",
    });
    const toolbar = screen
      .getByRole("button", { name: "Customize columns" })
      .closest("div.justify-between");

    expect(toolbar).toContainElement(filters);
  });

  it("honours the page size from the URL and keeps it in the filter links", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl()],
      total: 1,
      page: 1,
      pageSize: 100,
    });

    await renderPage({ size: "100" });

    const statusGroup = screen.getByRole("group", { name: "Status" });

    expect(fetchProcessedUrlsForExecutionMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 100 }),
    );
    expect(
      within(statusGroup).getByRole("link", { name: "failed" }),
    ).toHaveAttribute("href", `${BASE_PATH}?status=failed&page=1&size=100`);
  });

  it.each([
    ["collected", "success"],
    ["failed", "failed"],
    ["dropped", "muted"],
  ] as const)("shows a %s URL with the %s tone", async (status, tone) => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl({ status })],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    await renderPage();

    const table = screen.getByRole("table");

    expect(within(table).getByText(status)).toHaveAttribute("data-tone", tone);
  });

  it("marks the active filter and keeps other filters in the filter links", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl()],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    await renderPage({ agent: "data-collection", status: "failed" });

    const agentGroup = screen.getByRole("group", { name: "Agent" });
    const statusGroup = screen.getByRole("group", { name: "Status" });
    const activeAgent = within(agentGroup).getByRole("link", {
      name: "data-collection",
    });
    const allStatuses = within(statusGroup).getByRole("link", { name: "All" });

    expect(activeAgent).toHaveAttribute("aria-current", "true");
    expect(
      within(agentGroup).getByRole("link", { name: "All" }),
    ).not.toHaveAttribute("aria-current");
    expect(allStatuses).toHaveAttribute(
      "href",
      `${BASE_PATH}?agent=data-collection&page=1`,
    );
    expect(
      within(screen.getByRole("group", { name: "Gate" })).getByRole("link", {
        name: "passed",
      }),
    ).toHaveAttribute(
      "href",
      `${BASE_PATH}?agent=data-collection&status=failed&gateStatus=passed&page=1`,
    );
  });

  it("paginates with the active filters preserved", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl()],
      total: 120,
      page: 1,
      pageSize: 50,
    });

    await renderPage({ status: "dropped" });

    const pagination = screen.getByRole("navigation", {
      name: "Processed URLs pagination",
    });
    const nextLink = within(pagination).getByRole("link", {
      name: "Go to next page",
    });
    const nextHref = new URL(nextLink.getAttribute("href") ?? "", "http://x");

    expect(pagination).toHaveTextContent("Showing 1–50 of 120");
    expect(nextHref.pathname).toBe(BASE_PATH);
    expect(nextHref.searchParams.get("page")).toBe("2");
    expect(nextHref.searchParams.get("status")).toBe("dropped");
  });

  it("explains an execution without processed URLs", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    await renderPage();

    expect(screen.getByText("No processed URLs")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Clear filters" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers to clear filters when nothing matches them", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    await renderPage({ gateStatus: "failed" });

    expect(
      screen.getByText("No processed URLs match these filters"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      BASE_PATH,
    );
  });

  it("shows the load error inline when the domain request fails", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockRejectedValue(
      new Error("domain-api unavailable"),
    );

    await renderPage();

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Could not load processed URLs");
    expect(alert).toHaveTextContent("domain-api unavailable");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("rejects instead of rendering when the admin check fails", async () => {
    withDashboardAdminMock.mockRejectedValue(new Error("NEXT_REDIRECT"));
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    const pending = renderPage();

    await expect(pending).rejects.toThrow("NEXT_REDIRECT");
  });
});
