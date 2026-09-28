/** @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DomainTableRowActions,
  getDomainTableRowDeleteLabel,
} from "./domain-table-row-actions";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

vi.mock("@workspace/ui/components/dropdown-menu", () => ({
  DropdownMenu: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
  }: React.PropsWithChildren<{
    onSelect?: (event: Event) => void;
    disabled?: boolean;
  }>) => (
    <div
      role="menuitem"
      aria-disabled={disabled}
      onClick={() => onSelect?.(new Event("select"))}
    >
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@workspace/ui/components/dialog", () => ({
  Dialog: ({ open, children }: React.PropsWithChildren<{ open?: boolean }>) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
}));

const nameField: DomainTableFormField = {
  kind: "string",
  key: "name",
  label: "Name",
  required: false,
  nullable: false,
};

const renderEditModal = (updateAction: (formData: FormData) => Promise<void>) =>
  render(
    <DomainTableRowActions
      rowId="row-1"
      row={{ id: "row-1", name: "Ada" }}
      updateFields={[nameField]}
      updateAction={updateAction}
      deleteAction={vi.fn()}
      showEdit
      showDelete={false}
    />,
  );

describe("getDomainTableRowDeleteLabel", () => {
  it("uses trimmed name when present", () => {
    const label = getDomainTableRowDeleteLabel({ name: "  PERSON  " }, "id-1");

    expect(label).toBe("PERSON");
  });

  it("falls back to row id when name is missing or blank", () => {
    const missing = getDomainTableRowDeleteLabel({}, "row-2");
    const blank = getDomainTableRowDeleteLabel({ name: "   " }, "row-3");

    expect(missing).toBe("row-2");
    expect(blank).toBe("row-3");
  });

  it("falls back to row id when name is not a string", () => {
    const label = getDomainTableRowDeleteLabel({ name: 42 }, "row-4");

    expect(label).toBe("row-4");
  });
});

describe("DomainTableRowActions edit modal", () => {
  it("shows a saving state while the update is pending and closes on success", async () => {
    let resolveUpdate: (() => void) | undefined;
    const updateAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    renderEditModal(updateAction);

    fireEvent.click(screen.getByText("Edit"));
    const saveButton = screen.getByRole("button", { name: "Save" });

    fireEvent.click(saveButton);

    expect(updateAction).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();

    resolveUpdate?.();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Sav(e|ing)/ }),
      ).not.toBeInTheDocument();
    });
  });
});

describe("DomainTableRowActions delete confirmation", () => {
  const renderDeleteActions = (
    deleteAction: (formData: FormData) => Promise<void>,
  ) =>
    render(
      <DomainTableRowActions
        rowId="row-1"
        row={{ id: "row-1", name: "Ada" }}
        updateFields={[]}
        updateAction={vi.fn()}
        deleteAction={deleteAction}
        showEdit={false}
        showDelete
      />,
    );

  it("asks for confirmation before deleting the row", () => {
    const deleteAction = vi.fn(async () => undefined);
    renderDeleteActions(deleteAction);

    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("alertdialog");

    expect(dialog).toHaveTextContent('Delete "Ada"?');
    expect(dialog).toHaveTextContent("This cannot be undone.");
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("does not delete when the user cancels", () => {
    const deleteAction = vi.fn(async () => undefined);
    renderDeleteActions(deleteAction);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("submits the row id to the delete action once confirmed", async () => {
    const deleteAction = vi.fn<(formData: FormData) => Promise<void>>(
      async () => undefined,
    );
    renderDeleteActions(deleteAction);
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteAction).toHaveBeenCalledTimes(1);
    });

    const submittedFormData = deleteAction.mock.calls[0]?.[0];

    expect(submittedFormData?.get("__id")).toBe("row-1");
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});

describe("DomainTableRowActions navigation items", () => {
  it("links view and edit when hrefs are provided", () => {
    render(
      <DomainTableRowActions
        rowId="row-1"
        row={{ id: "row-1" }}
        updateFields={[nameField]}
        updateAction={vi.fn()}
        deleteAction={vi.fn()}
        showEdit
        showDelete={false}
        editHref="/dashboard/acme/items/row-1/edit"
        showView
        viewHref="/dashboard/acme/items/row-1"
      />,
    );

    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/dashboard/acme/items/row-1",
    );
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/dashboard/acme/items/row-1/edit",
    );
    expect(
      screen.getByRole("button", { name: "Actions for row-1" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
