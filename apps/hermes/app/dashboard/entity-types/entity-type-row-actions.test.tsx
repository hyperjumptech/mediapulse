import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EntityTypeRowActions } from "./entity-type-row-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock(
  "@/app/dashboard/entity-types/actions/delete/.generated/use-form-action",
  () => ({
    useFormAction: vi.fn(() => ({
      FormWithAction: ({
        children,
      }: React.PropsWithChildren<{ className?: string }>) => (
        <form>{children}</form>
      ),
      state: null,
      pending: false,
    })),
  }),
);

vi.mock("@/components/delete-confirm-form", () => ({
  DeleteConfirmForm: ({ confirmMessage }: { confirmMessage: string }) => (
    <button>{confirmMessage}</button>
  ),
}));

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({ children }: React.PropsWithChildren) => (
    <button>{children}</button>
  ),
}));

describe("EntityTypeRowActions", () => {
  it("renders delete confirm message", () => {
    // Act
    render(
      <EntityTypeRowActions
        entityTypeId="et-1"
        entityTypeName="COMPANY"
        onEditClick={vi.fn()}
      />,
    );

    // Assert
    expect(
      screen.getByText('Delete entity type "COMPANY"? This cannot be undone.'),
    ).toBeInTheDocument();
  });
});
