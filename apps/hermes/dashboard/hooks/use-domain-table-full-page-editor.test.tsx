/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDomainTableFullPageEditor } from "./use-domain-table-full-page-editor";

describe("useDomainTableFullPageEditor", () => {
  it("does not call preview when preview field key is undefined", async () => {
    const runPreview = vi.fn();
    const { result } = renderHook(() =>
      useDomainTableFullPageEditor({
        previewFieldKey: undefined,
        integrationId: "k",
        runPreview,
      }),
    );

    await act(async () => {
      await result.current.runPreviewClick();
    });

    expect(runPreview).not.toHaveBeenCalled();
  });

  it("calls preview with trimmed value from the bound form", async () => {
    const runPreview = vi
      .fn()
      .mockResolvedValue({ success: true, values: [1] });
    const { result } = renderHook(() =>
      useDomainTableFullPageEditor({
        previewFieldKey: "expansionString",
        integrationId: "k",
        runPreview,
      }),
    );

    const form = document.createElement("form");
    const input = document.createElement("input");
    input.name = "expansionString";
    input.value = "  db:ticker:id  ";
    form.appendChild(input);

    await act(() => {
      result.current.formRef.current = form;
    });

    await act(async () => {
      await result.current.runPreviewClick();
    });

    expect(runPreview).toHaveBeenCalledWith("k", "db:ticker:id");
    expect(result.current.previewResult).toEqual({
      success: true,
      values: [1],
    });
  });
});
