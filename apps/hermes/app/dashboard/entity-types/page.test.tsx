import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const getEntityTypesPageMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/entity-types", () => ({
  getEntityTypesPage: (...args: unknown[]) => getEntityTypesPageMock(...args),
}));

vi.mock("./entity-type-modal", () => ({
  EntityTypeModal: () => (
    <button data-testid="entity-type-modal">Add entity type</button>
  ),
}));

vi.mock("./entity-types-table", () => ({
  EntityTypesTable: ({
    entityTypes,
  }: {
    entityTypes: Array<{ id: string; name: string }>;
  }) => (
    <div data-testid="entity-types-table" data-count={entityTypes.length}>
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

vi.mock("./entity-types-search", () => ({
  EntityTypesSearch: ({ initialQuery }: { initialQuery?: string }) => (
    <div data-testid="entity-types-search" data-query={initialQuery ?? ""}>
      Search
    </div>
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <P extends Record<string, unknown>>(
    Component: (props: P) => React.ReactNode,
  ) => Component,
}));

import EntityTypesPage from "./page";

describe("EntityTypesPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getEntityTypesPageMock.mockReset();
  });

  it("renders table and pagination", async () => {
    // Setup
    getEntityTypesPageMock.mockResolvedValue({
      entityTypes: [{ id: "1", name: "COMPANY", description: null }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Act
    const component = await EntityTypesPage({ searchParams: {} });
    render(component);

    // Assert
    expect(screen.getByTestId("entity-types-table")).toBeInTheDocument();
    expect(screen.getByTestId("pagination")).toBeInTheDocument();
  });
});
