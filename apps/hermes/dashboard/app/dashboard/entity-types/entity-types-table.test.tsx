import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntityTypesTable } from "./entity-types-table";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@workspace/ui/components/table", () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableCell: ({ children }: React.PropsWithChildren<{ colSpan?: number }>) => (
    <td>{children}</td>
  ),
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
}));

vi.mock("./entity-type-row-actions", () => ({
  EntityTypeRowActions: ({ entityTypeName }: { entityTypeName: string }) => (
    <div data-testid="row-actions">{entityTypeName}</div>
  ),
}));

vi.mock("./entity-type-modal", () => ({
  EntityTypeModal: () => <div data-testid="edit-modal" />,
}));

describe("EntityTypesTable", () => {
  it("renders rows", () => {
    // Act
    render(
      <EntityTypesTable
        entityTypes={[
          {
            id: "et-1",
            name: "COMPANY",
            description: "Organization",
            createdAt: new Date("2025-01-01"),
            updatedAt: new Date("2025-01-01"),
          },
        ]}
        sortBy="name"
        sortDir="asc"
        pageSize={15}
      />,
    );

    // Assert
    expect(screen.getAllByText("COMPANY").length).toBeGreaterThan(0);
    expect(screen.getByTestId("row-actions")).toBeInTheDocument();
  });
});
