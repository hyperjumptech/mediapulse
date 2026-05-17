/** @vitest-environment jsdom */

import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getDomainTableMetaMock = vi.fn();
const getDomainTableItemByIdMock = vi.fn();
const getDomainIntegrationByIntegrationIdMock = vi.fn();

vi.mock("@/lib/domain-dashboard", () => ({
  getDomainTableMeta: (...args: unknown[]) => getDomainTableMetaMock(...args),
  getDomainTableItemById: (...args: unknown[]) =>
    getDomainTableItemByIdMock(...args),
}));

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: (...args: unknown[]) =>
    getDomainIntegrationByIntegrationIdMock(...args),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
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

    expect(screen.getByText("Example headline")).toBeInTheDocument();
    expect(screen.getByText("Full body text")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /example\.com\/article/i }),
    ).toHaveAttribute("href", "https://example.com/article");
    expect(getDomainTableItemByIdMock).toHaveBeenCalledWith(
      "mediapulse",
      "data-sources",
      "row-1",
    );
  });
});
