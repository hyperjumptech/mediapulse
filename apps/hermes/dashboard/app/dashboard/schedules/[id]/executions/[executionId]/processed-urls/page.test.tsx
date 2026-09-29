import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcessedUrlItem } from "@/lib/domain-dashboard";

const withDashboardAdminMock = vi.fn();
const fetchProcessedUrlsForExecutionMock = vi.fn();
const loadProcessedUrlsExecutionMock = vi.fn();

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: (load: Promise<unknown>) => withDashboardAdminMock(load),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  fetchProcessedUrlsForExecution: (...args: unknown[]) =>
    fetchProcessedUrlsForExecutionMock(...args),
}));

vi.mock("./processed-urls-execution", () => ({
  loadProcessedUrlsExecution: (...args: unknown[]) =>
    loadProcessedUrlsExecutionMock(...args),
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
  subject: { id: "subject-1", label: "ACME" },
  agent: "collector",
  url: "https://example.com/article",
  status: "collected",
  reason: null,
  reasonDetail: null,
  source: null,
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
  beforeEach(() => {
    loadProcessedUrlsExecutionMock.mockResolvedValue({
      integrationId: "integration-a",
      agentIds: ["collector", "crawler"],
    });
  });

  afterEach(() => {
    withDashboardAdminMock.mockReset();
    fetchProcessedUrlsForExecutionMock.mockReset();
    loadProcessedUrlsExecutionMock.mockReset();
  });

  it("loads processed URLs from the execution's integration and renders them", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl()],
      total: 1,
      page: 2,
      pageSize: 50,
      subjectTitle: "Account",
    });

    await renderPage({ page: "2", agent: "collector" });

    const table = screen.getByRole("table");
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((header) => header.textContent);

    expect(loadProcessedUrlsExecutionMock).toHaveBeenCalledWith(
      "schedule-1",
      "execution-1",
    );
    expect(fetchProcessedUrlsForExecutionMock).toHaveBeenCalledWith({
      integrationId: "integration-a",
      scheduleExecutionId: "execution-1",
      page: 2,
      pageSize: 50,
      subjectId: undefined,
      agent: "collector",
      status: undefined,
      gateStatus: undefined,
    });
    expect(within(table).getByText("ACME")).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "example.com/article" }),
    ).toHaveAttribute("href", "https://example.com/article");
    expect(headers).toEqual([
      "Account",
      "URL",
      "Status",
      "Reason",
      "Agent",
      "Time",
    ]);
    expect(screen.queryByText(/Back to execution/)).not.toBeInTheDocument();
  });

  it("leaves out the subject column when the domain sends no subject", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl({ subject: undefined })],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    await renderPage();

    const table = screen.getByRole("table");
    const firstHeader = within(table).getAllByRole("columnheader")[0];

    expect(firstHeader).toHaveTextContent("URL");
    expect(within(table).queryByText("Subject")).not.toBeInTheDocument();
  });

  it("forwards the subject filter and treats it as an active filter", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    await renderPage({ subjectId: "subject-1" });

    const statusGroup = screen.getByRole("group", { name: "Status" });

    expect(fetchProcessedUrlsForExecutionMock).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: "subject-1" }),
    );
    expect(
      screen.getByText("No processed URLs match these filters"),
    ).toBeInTheDocument();
    expect(
      within(statusGroup).getByRole("link", { name: "failed" }),
    ).toHaveAttribute(
      "href",
      `${BASE_PATH}?subjectId=subject-1&status=failed&page=1`,
    );
  });

  it("offers the agents that ran in the execution as agent filters", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [processedUrl()],
      total: 1,
      page: 1,
      pageSize: 50,
    });

    await renderPage();

    const agentGroup = screen.getByRole("group", { name: "Agent" });
    const agentOptions = within(agentGroup)
      .getAllByRole("link")
      .map((link) => link.textContent);

    expect(agentOptions).toEqual(["All", "collector", "crawler"]);
    expect(
      within(agentGroup).getByRole("link", { name: "crawler" }),
    ).toHaveAttribute("href", `${BASE_PATH}?agent=crawler&page=1`);
  });

  it("hides the agent filter when the execution ran no agents", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    loadProcessedUrlsExecutionMock.mockResolvedValue({
      integrationId: "integration-a",
      agentIds: [],
    });
    fetchProcessedUrlsForExecutionMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 50,
    });

    await renderPage();

    expect(
      screen.queryByRole("group", { name: "Agent" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Status" })).toBeInTheDocument();
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

    await renderPage({ agent: "collector", status: "failed" });

    const agentGroup = screen.getByRole("group", { name: "Agent" });
    const statusGroup = screen.getByRole("group", { name: "Status" });
    const activeAgent = within(agentGroup).getByRole("link", {
      name: "collector",
    });
    const allStatuses = within(statusGroup).getByRole("link", { name: "All" });

    expect(activeAgent).toHaveAttribute("aria-current", "true");
    expect(
      within(agentGroup).getByRole("link", { name: "All" }),
    ).not.toHaveAttribute("aria-current");
    expect(allStatuses).toHaveAttribute(
      "href",
      `${BASE_PATH}?agent=collector&page=1`,
    );
    expect(
      within(screen.getByRole("group", { name: "Gate" })).getByRole("link", {
        name: "passed",
      }),
    ).toHaveAttribute(
      "href",
      `${BASE_PATH}?agent=collector&status=failed&gateStatus=passed&page=1`,
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
      new Error('Domain integration "integration-a" is not active'),
    );

    await renderPage();

    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Could not load processed URLs");
    expect(alert).toHaveTextContent(
      'Domain integration "integration-a" is not active',
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("returns not found when the execution does not belong to the schedule", async () => {
    withDashboardAdminMock.mockImplementation((load: Promise<unknown>) => load);
    loadProcessedUrlsExecutionMock.mockResolvedValue(null);

    const pending = renderPage();

    await expect(pending).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(fetchProcessedUrlsForExecutionMock).not.toHaveBeenCalled();
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
