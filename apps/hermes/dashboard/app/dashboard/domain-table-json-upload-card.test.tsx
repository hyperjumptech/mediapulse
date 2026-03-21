import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

import { DomainTableJsonUploadCard } from "./domain-table-json-upload-card";
import type { DomainTableJsonImportState } from "@/lib/domain-dashboard";

const action: DashboardPageCustomAction = {
  id: "import-idx-json",
  label: "Import IDX JSON",
  description: "Upload JSON",
  ui: "json-file-upload",
  method: "POST",
  path: "/import-idx-json",
  accept: ".json,application/json",
};

describe("DomainTableJsonUploadCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders action label and description", () => {
    const serverAction = vi.fn(
      async (): Promise<DomainTableJsonImportState> => ({ status: "idle" }),
    );

    render(
      <DomainTableJsonUploadCard action={action} serverAction={serverAction} />,
    );

    expect(screen.getByText("Import IDX JSON")).toBeInTheDocument();
    expect(screen.getByText("Upload JSON")).toBeInTheDocument();
  });

  it("submits selected file contents via the server action", async () => {
    const serverAction = vi.fn(
      async (
        _prev: DomainTableJsonImportState,
        formData: FormData,
      ): Promise<DomainTableJsonImportState> => {
        expect(formData.get("__actionId")).toBe("import-idx-json");
        expect(formData.get("payloadJson")).toBe('{"data":[]}');
        return {
          status: "success",
          added: 1,
          updated: 0,
        };
      },
    );

    const { container } = render(
      <DomainTableJsonUploadCard action={action} serverAction={serverAction} />,
    );

    const jsonFile = new File(['{"data":[]}'], "t.json", {
      type: "application/json",
    });
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [jsonFile] } });

    const importButton = screen.getByRole("button", { name: /^Import$/i });
    await waitFor(() => {
      expect(importButton).not.toBeDisabled();
    });

    fireEvent.click(importButton);

    await waitFor(() => {
      expect(serverAction).toHaveBeenCalled();
    });
  });
});
