import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getRelationTypesPageMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/relation-types", () => ({
  getRelationTypesPage: (...args: unknown[]) =>
    getRelationTypesPageMock(...args),
}));

vi.mock("./relation-type-modal", () => ({
  RelationTypeModal: () => (
    <button data-testid="relation-type-modal">Add relation type</button>
  ),
}));

vi.mock("./relation-types-table", () => ({
  RelationTypesTable: ({
    relationTypes,
  }: {
    relationTypes: Array<{ id: string; name: string }>;
  }) => (
    <div data-testid="relation-types-table" data-count={relationTypes.length}>
      Table
    </div>
  ),
}));

vi.mock("@/components/list-pagination", () => ({
  ListPagination: ({ page, total }: { page: number; total: number }) => (
    <nav data-testid="pagination" data-page={page} data-total={total}>
      Pagination
    </nav>
  ),
}));

vi.mock("./relation-types-search", () => ({
  RelationTypesSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="relation-types-search" data-query={initialQuery ?? ""}>
      Search
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import RelationTypesPage from "./page";

describe("RelationTypesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getRelationTypesPageMock.mockReset();
  });

  it("renders table and pagination", async () => {
    // Setup
    getRelationTypesPageMock.mockResolvedValue({
      relationTypes: [{ id: "1", name: "CEO_OF", description: null }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    const component = await RelationTypesPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("relation-types-table")).toBeInTheDocument();
    expect(screen.getByTestId("pagination")).toBeInTheDocument();
  });
});
