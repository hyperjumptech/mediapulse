/** @vitest-environment jsdom */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  DomainTableRowActions,
  getDomainTableRowDeleteLabel,
} from "./domain-table-row-actions";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

// Render the dropdown inline and fire `onSelect` on click so the edit modal can
// be opened without Radix's portal/pointer machinery.
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
  }: React.PropsWithChildren<{ onSelect?: (event: Event) => void }>) => (
    <div onClick={() => onSelect?.(new Event("select"))}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

// Render dialog content only while `open`, so closing the modal unmounts the form.
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
    // Act
    const label = getDomainTableRowDeleteLabel({ name: "  PERSON  " }, "id-1");

    // Assert
    expect(label).toBe("PERSON");
  });

  it("falls back to row id when name is missing or blank", () => {
    // Act
    const missing = getDomainTableRowDeleteLabel({}, "row-2");
    const blank = getDomainTableRowDeleteLabel({ name: "   " }, "row-3");

    // Assert
    expect(missing).toBe("row-2");
    expect(blank).toBe("row-3");
  });

  it("falls back to row id when name is not a string", () => {
    // Act
    const label = getDomainTableRowDeleteLabel({ name: 42 }, "row-4");

    // Assert
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
