import type { ChangeEvent, FormEvent } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardPageCustomAction } from "@hermes/domain-contract";

import type { DomainTableJsonImportState } from "@/lib/domain-dashboard";

import { useDomainTableJsonUploadForm } from "./use-domain-table-json-upload-form";

type ImportAction = (
  state: DomainTableJsonImportState,
  formData: FormData,
) => Promise<DomainTableJsonImportState>;

const action: DashboardPageCustomAction = {
  id: "import-json",
  label: "Import JSON",
  ui: "json-file-upload",
  method: "POST",
  path: "/import-json",
};

const submitEvent = () =>
  ({ preventDefault: vi.fn() }) as unknown as FormEvent<HTMLFormElement>;

const fileChangeEvent = (file: File) =>
  ({
    target: { files: [file] },
  }) as unknown as ChangeEvent<HTMLInputElement>;

describe("useDomainTableJsonUploadForm", () => {
  it("asks for a file before submitting", async () => {
    const serverAction = vi.fn();
    const { result } = renderHook(() =>
      useDomainTableJsonUploadForm({ action, serverAction }),
    );

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.errorMessage).toBe("Select a JSON file first.");
    expect(serverAction).not.toHaveBeenCalled();
  });

  it("clears the missing-file error once a file is chosen", async () => {
    const { result } = renderHook(() =>
      useDomainTableJsonUploadForm({ action, serverAction: vi.fn() }),
    );
    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    act(() => {
      result.current.handleFileChange(
        fileChangeEvent(new File(["[]"], "items.json")),
      );
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.file?.name).toBe("items.json");
  });

  it("sends the file text with the action id and exposes the server error", async () => {
    const serverAction = vi.fn<ImportAction>(async () => ({
      status: "error",
      message: "Invalid JSON",
    }));
    const { result } = renderHook(() =>
      useDomainTableJsonUploadForm({ action, serverAction }),
    );
    act(() => {
      result.current.handleFileChange(
        fileChangeEvent(new File(["[1]"], "items.json")),
      );
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBe("Invalid JSON");
    });
    const submitted = serverAction.mock.calls[0]?.[1];

    expect(submitted?.get("__actionId")).toBe("import-json");
    expect(submitted?.get("payloadJson")).toBe("[1]");
  });
});
