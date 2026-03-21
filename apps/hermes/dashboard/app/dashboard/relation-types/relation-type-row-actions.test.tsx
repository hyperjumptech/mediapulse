import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RelationTypeRowActions } from "./relation-type-row-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock(
  "@/app/dashboard/relation-types/actions/delete/.generated/use-form-action",
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

describe("RelationTypeRowActions", () => {
  it("renders delete confirm message", () => {
    // Act
    render(
      <RelationTypeRowActions
        relationTypeId="rt-1"
        relationTypeName="CEO_OF"
        onEditClick={vi.fn()}
      />,
    );

    // Assert
    expect(
      screen.getByText('Delete relation type "CEO_OF"? This cannot be undone.'),
    ).toBeInTheDocument();
  });
});
