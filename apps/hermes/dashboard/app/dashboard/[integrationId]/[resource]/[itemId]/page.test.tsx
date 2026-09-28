/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDomainTableMetaMock = vi.fn();
const getDomainTableItemByIdMock = vi.fn();
const getDomainIntegrationByIntegrationIdMock = vi.fn();

vi.mock("@/lib/date-time/viewer-date-time", () => ({
  getViewerDateTimeContext: async () => ({
    timeZone: "UTC",
    renderedAt: Date.parse("2026-09-28T12:00:00.000Z"),
  }),
}));

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableMeta: (...args: unknown[]) => getDomainTableMetaMock(...args),
  getDomainTableItemById: (...args: unknown[]) =>
    getDomainTableItemByIdMock(...args),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: (...args: unknown[]) =>
    getDomainIntegrationByIntegrationIdMock(...args),
}));

vi.mock("@/lib/require-dashboard-admin", () => ({
  withDashboardAdmin: <Value,>(load: Promise<Value>) => load,
  requireDashboardAdmin: vi.fn().mockResolvedValue({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
  getDashboardAdmin: vi.fn().mockResolvedValue({
    id: "u1",
    name: "U",
    email: "u@example.com",
    credentialVersion: 0,
  }),
}));

import ViewDomainTableItemPage from "./page";

describe("ViewDomainTableItemPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getDomainTableMetaMock.mockReset();
    getDomainTableItemByIdMock.mockReset();
    getDomainIntegrationByIntegrationIdMock.mockReset();
  });

  it("renders detailBlocks when the manifest declares them", async () => {
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue({
      id: "int-1",
      integrationId: "mediapulse",
    });
    getDomainTableMetaMock.mockResolvedValue({
      title: "Newsletters",
      description: "Generated newsletters",
      actions: {
        create: false,
        update: false,
        delete: false,
        view: true,
      },
      detailBlocks: [
        {
          type: "keyValue",
          label: "Metadata",
          rows: [{ field: "subject", label: "Subject" }],
        },
      ],
    });
    getDomainTableItemByIdMock.mockResolvedValue({
      id: "n-1",
      subject: "Apple weekly digest",
      title: "Newsletter detail",
    });

    const ui = await ViewDomainTableItemPage({
      params: Promise.resolve({
        integrationId: "mediapulse",
        resource: "newsletters",
        itemId: "n-1",
      }),
    });
    render(ui);

    expect(screen.getByText("Metadata")).toBeInTheDocument();
    expect(screen.getByText("Apple weekly digest")).toBeInTheDocument();
  });

  it("renders detail when manifest has view action and row loads", async () => {
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue({
      id: "int-1",
      integrationId: "mediapulse",
    });
    getDomainTableMetaMock.mockResolvedValue({
      title: "Data sources",
      description: "Collected pages",
      columns: [
        { key: "title", label: "Title", type: "text" },
        { key: "url", label: "URL", type: "url" },
        { key: "content", label: "Content", type: "text" },
      ],
      actions: {
        create: false,
        update: false,
        delete: false,
        view: true,
      },
    });
    getDomainTableItemByIdMock.mockResolvedValue({
      id: "row-1",
      title: "Example headline",
      url: "https://example.com/article",
      content: "Full body text",
      tickerSymbol: "ACME",
      searchQueryText: "news",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-02T00:00:00.000Z",
      metadata: null,
    });

    const ui = await ViewDomainTableItemPage({
      params: Promise.resolve({
        integrationId: "mediapulse",
        resource: "data-sources",
        itemId: "row-1",
      }),
    });
    render(ui);

    expect(screen.getAllByText("Example headline").length).toBeGreaterThan(0);
    expect(screen.getByText("Full body text")).toBeInTheDocument();
    expect(screen.getByText("https://example.com/article")).toBeInTheDocument();
    expect(getDomainTableItemByIdMock).toHaveBeenCalledWith(
      "mediapulse",
      "data-sources",
      "row-1",
    );
  });
});

describe("ViewDomainTableItemPage header", () => {
  const givenIntegration = () => {
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue({
      id: "int-1",
      integrationId: "mediapulse",
    });
  };

  const renderItemPage = async () => {
    const ui = await ViewDomainTableItemPage({
      params: Promise.resolve({
        integrationId: "mediapulse",
        resource: "data-sources",
        itemId: "row 1",
      }),
    });

    return render(ui);
  };

  afterEach(() => {
    getDomainTableMetaMock.mockReset();
    getDomainTableItemByIdMock.mockReset();
    getDomainIntegrationByIntegrationIdMock.mockReset();
  });

  it("links to the full-page editor when the manifest allows updates", async () => {
    // Setup
    givenIntegration();
    getDomainTableMetaMock.mockResolvedValue({
      title: "Data sources",
      description: "Collected pages",
      columns: [{ key: "title", label: "Title", type: "text" }],
      createNavigation: "full-page",
      updateSchema: {
        type: "object",
        properties: { title: { type: "string", title: "Title" } },
      },
      actions: { create: false, update: true, delete: false, view: true },
    });
    getDomainTableItemByIdMock.mockResolvedValue({
      id: "row 1",
      title: "Example headline",
    });

    // Act
    await renderItemPage();

    // Assert
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/data-sources/row%201/edit",
    );
    expect(
      screen.queryByRole("link", { name: "Back to list" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["the editor is a modal", { createNavigation: "modal" }],
    ["updates are not allowed", { actions: { update: false, view: true } }],
    ["the update schema has no fields", { updateSchema: {} }],
  ])("hides Edit when %s", async (_reason, metaOverrides) => {
    // Setup
    givenIntegration();
    getDomainTableMetaMock.mockResolvedValue({
      title: "Data sources",
      columns: [{ key: "title", label: "Title", type: "text" }],
      createNavigation: "full-page",
      updateSchema: {
        type: "object",
        properties: { title: { type: "string", title: "Title" } },
      },
      actions: { create: false, update: true, delete: false, view: true },
      ...metaOverrides,
    });
    getDomainTableItemByIdMock.mockResolvedValue({
      id: "row 1",
      title: "Example headline",
    });

    // Act
    const { container } = await renderItemPage();

    // Assert
    expect(
      screen.queryByRole("link", { name: "Edit" }),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="page-header-actions"]'),
    ).toBeNull();
  });

  it("renders column values in a summary grid and spans long values", async () => {
    // Setup
    givenIntegration();
    getDomainTableMetaMock.mockResolvedValue({
      title: "Data sources",
      columns: [
        { key: "title", label: "Title", type: "text" },
        { key: "ticker", label: "Ticker", type: "text" },
        { key: "content", label: "Content", type: "text" },
        { key: "empty", label: "Empty", type: "text" },
      ],
      actions: { create: false, update: false, delete: false, view: true },
    });
    getDomainTableItemByIdMock.mockResolvedValue({
      id: "row 1",
      title: "Example headline",
      ticker: "ACME",
      content: "Line one\nLine two",
      empty: "",
    });

    // Act
    const { container } = await renderItemPage();

    // Assert
    const grid = container.querySelector('[data-slot="summary-grid"]');
    const contentItem = screen.getByText("Content", { selector: "dt" })
      .parentElement as HTMLElement;
    const tickerItem = screen.getByText("Ticker", { selector: "dt" })
      .parentElement as HTMLElement;

    expect(grid).not.toBeNull();
    expect(contentItem).toHaveClass("col-span-full");
    expect(tickerItem).not.toHaveClass("col-span-full");
    expect(screen.queryByText("Empty", { selector: "dt" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Example headline",
    );
  });

  it("explains when the item has no values to show", async () => {
    // Setup
    givenIntegration();
    getDomainTableMetaMock.mockResolvedValue({
      title: "Data sources",
      columns: [{ key: "title", label: "Title", type: "text" }],
      actions: { create: false, update: false, delete: false, view: true },
    });
    getDomainTableItemByIdMock.mockResolvedValue({ id: "row 1", title: "" });

    // Act
    await renderItemPage();

    // Assert
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Detail",
    );
    expect(
      screen.getByText("This item has no values to show."),
    ).toBeInTheDocument();
  });
});
