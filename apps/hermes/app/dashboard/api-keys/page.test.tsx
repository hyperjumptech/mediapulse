import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getApiKeysPageMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({}),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/api-keys", () => ({
  getApiKeysPage: (...args: unknown[]) => getApiKeysPageMock(...args),
}));

vi.mock("./add-api-key-modal", () => ({
  AddApiKeyModal: () => (
    <button data-testid="add-api-key-modal">Add API key</button>
  ),
}));

vi.mock("./api-keys-table-with-edit", () => ({
  ApiKeysTableWithEdit: ({
    apiKeys,
  }: {
    apiKeys: Array<{ id: string; name: string }>;
  }) => (
    <div data-testid="api-keys-table-with-edit" data-count={apiKeys.length}>
      Table
    </div>
  ),
}));

vi.mock("./api-keys-pagination", () => ({
  ApiKeysPagination: ({ page, total }: { page: number; total: number }) => (
    <nav data-testid="api-keys-pagination" data-page={page} data-total={total}>
      Pagination
    </nav>
  ),
}));

vi.mock("./api-keys-search", () => ({
  ApiKeysSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="api-keys-search" data-query={initialQuery ?? ""}>
      Search
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import ApiKeysPage from "./page";

describe("ApiKeysPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getApiKeysPageMock.mockReset();
  });

  it("renders API keys table with data when authenticated", async () => {
    getApiKeysPageMock.mockResolvedValue({
      apiKeys: [
        {
          id: "1",
          name: "Test key",
          key: "hash",
          isActive: true,
          userId: "u1",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: "u1", name: "Admin", email: "admin@example.com" },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    const component = await ApiKeysPage({ searchParams: {} });
    render(component);

    expect(screen.getByTestId("api-keys-table-with-edit")).toBeInTheDocument();
    expect(screen.getByTestId("api-keys-table-with-edit")).toHaveAttribute(
      "data-count",
      "1",
    );
  });

  it("renders add API key modal button", async () => {
    getApiKeysPageMock.mockResolvedValue({
      apiKeys: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    const component = await ApiKeysPage({ searchParams: {} });
    render(component);

    expect(screen.getByTestId("add-api-key-modal")).toBeInTheDocument();
  });

  it("renders pagination", async () => {
    getApiKeysPageMock.mockResolvedValue({
      apiKeys: [],
      total: 30,
      page: 2,
      pageSize: 15,
    });

    const component = await ApiKeysPage({ searchParams: { page: "2" } });
    render(component);

    expect(screen.getByTestId("api-keys-pagination")).toHaveAttribute(
      "data-page",
      "2",
    );
    expect(screen.getByTestId("api-keys-pagination")).toHaveAttribute(
      "data-total",
      "30",
    );
  });

  it("passes search query to getApiKeysPage", async () => {
    getApiKeysPageMock.mockResolvedValue({
      apiKeys: [],
      total: 0,
      page: 1,
      pageSize: 15,
    });

    await ApiKeysPage({ searchParams: { q: "prod" } });

    expect(getApiKeysPageMock).toHaveBeenCalledWith(
      1,
      15,
      expect.objectContaining({ search: "prod" }),
    );
  });
});
