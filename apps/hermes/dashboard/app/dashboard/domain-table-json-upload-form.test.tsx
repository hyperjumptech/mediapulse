import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";
import { Dialog, DialogContent } from "@workspace/ui/components/dialog";

import type { DomainTableJsonImportState } from "@/lib/domain-dashboard";

import { DomainTableJsonUploadForm } from "./domain-table-json-upload-form";

type ImportAction = (
  state: DomainTableJsonImportState,
  formData: FormData,
) => Promise<DomainTableJsonImportState>;

const action: DashboardPageCustomAction = {
  id: "import-json",
  label: "Import JSON",
  description: "Upload JSON",
  ui: "json-file-upload",
  method: "POST",
  path: "/import-json",
  accept: ".json,application/json",
};

const renderForm = (
  serverAction: (
    state: DomainTableJsonImportState,
    formData: FormData,
  ) => Promise<DomainTableJsonImportState>,
) =>
  render(
    <Dialog open>
      <DialogContent aria-describedby={undefined}>
        <DomainTableJsonUploadForm
          action={action}
          serverAction={serverAction}
        />
      </DialogContent>
    </Dialog>,
  );

const chooseFile = (contents: string) => {
  const jsonFile = new File([contents], "items.json", {
    type: "application/json",
  });
  fireEvent.change(screen.getByLabelText("JSON file"), {
    target: { files: [jsonFile] },
  });
};

describe("DomainTableJsonUploadForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts the file types the manifest declares and waits for a file", () => {
    renderForm(vi.fn());

    expect(screen.getByLabelText("JSON file")).toHaveAttribute(
      "accept",
      ".json,application/json",
    );
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("submits the selected file contents and reports the result", async () => {
    const serverAction = vi.fn<ImportAction>(async () => ({
      status: "success",
      added: 2,
      updated: 1,
    }));
    renderForm(serverAction);
    chooseFile('{"data":[]}');

    const importButton = screen.getByRole("button", { name: "Import" });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });
    fireEvent.click(importButton);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "2 added, 1 updated.",
    );
    const submitted = serverAction.mock.calls[0]?.[1];

    expect(submitted?.get("__actionId")).toBe("import-json");
    expect(submitted?.get("payloadJson")).toBe('{"data":[]}');
  });

  it("shows the server error in the dialog footer", async () => {
    renderForm(
      vi.fn(
        async (): Promise<DomainTableJsonImportState> => ({
          status: "error",
          message: "Invalid JSON",
        }),
      ),
    );
    chooseFile("not json");

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid JSON");
  });
});
