import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

import { DomainTableJsonImportDialog } from "./domain-table-json-import-dialog";

const action: DashboardPageCustomAction = {
  id: "import-json",
  label: "Import JSON",
  description: "Upload a JSON export.",
  ui: "json-file-upload",
  method: "POST",
  path: "/import-json",
};

describe("DomainTableJsonImportDialog", () => {
  it("renders a small outline toolbar button instead of an inline form", () => {
    render(
      <DomainTableJsonImportDialog action={action} serverAction={vi.fn()} />,
    );

    const trigger = screen.getByRole("button", { name: "Import JSON" });

    expect(trigger).toHaveAttribute("data-variant", "outline");
    expect(trigger).toHaveAttribute("data-size", "sm");
    expect(screen.queryByLabelText("JSON file")).not.toBeInTheDocument();
  });

  it("opens the upload form in a dialog", () => {
    render(
      <DomainTableJsonImportDialog action={action} serverAction={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Import JSON" }));

    const dialog = screen.getByRole("dialog", { name: "Import JSON" });

    expect(dialog).toHaveAccessibleDescription("Upload a JSON export.");
    expect(screen.getByLabelText("JSON file")).toHaveAttribute("type", "file");
  });
});
