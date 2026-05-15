/** @vitest-environment jsdom */
import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSchemaFormTouch } from "./use-schema-form-touch";

describe("useSchemaFormTouch", () => {
  it("starts untouched and updates on setTouched", () => {
    const { result } = renderHook(() => useSchemaFormTouch());

    expect(result.current.touched).toBe(false);

    act(() => {
      result.current.setTouched(true);
    });

    expect(result.current.touched).toBe(true);
  });
});
