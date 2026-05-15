/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SCHEMA_FORM_NEW_ENTRY_KEY } from "./schema-form-constants";
import { useRecordEntryDraftKey } from "./use-record-entry-draft-key";

describe("useRecordEntryDraftKey", () => {
  it("commits trimmed key on blur when non-empty and not the placeholder key", () => {
    const onKeyChange = vi.fn();
    const { result } = renderHook(() => useRecordEntryDraftKey(onKeyChange));

    act(() => {
      result.current.setDraftKey("my-key");
    });
    act(() => {
      result.current.handleBlur();
    });

    expect(onKeyChange).toHaveBeenCalledWith("my-key");
  });

  it("does not commit placeholder or empty draft on blur", () => {
    const onKeyChange = vi.fn();
    const { result } = renderHook(() => useRecordEntryDraftKey(onKeyChange));

    act(() => {
      result.current.setDraftKey(SCHEMA_FORM_NEW_ENTRY_KEY);
    });
    act(() => {
      result.current.handleBlur();
    });

    expect(onKeyChange).not.toHaveBeenCalled();
  });
});
