/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSchemaFormSeed } from "./use-schema-form-seed";
import type { JsonSchema } from "./types";

describe("useSchemaFormSeed", () => {
  it("calls onChange when required keys are missing", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
      },
    };
    const onChange = vi.fn();

    renderHook(() => useSchemaFormSeed(schema, {}, onChange));

    expect(onChange).toHaveBeenCalledWith({ name: "" });
  });

  it("does not call onChange when value already satisfies required keys", () => {
    const schema: JsonSchema = {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string" },
      },
    };
    const onChange = vi.fn();

    renderHook(() => useSchemaFormSeed(schema, { name: "ok" }, onChange));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onChange for optional defaulted fields when top-level required is empty", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: true },
        label: { type: "string", default: "{{NAME}}" },
      },
    };
    const onChange = vi.fn();

    renderHook(() => useSchemaFormSeed(schema, {}, onChange));

    expect(onChange).toHaveBeenCalledWith({
      enabled: true,
      label: "{{NAME}}",
    });
  });

  it("does not call onChange again once seeding is complete", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        enabled: { type: "boolean", default: true },
      },
    };
    const onChange = vi.fn();
    const seeded = { enabled: true };

    renderHook(() => useSchemaFormSeed(schema, seeded, onChange));

    expect(onChange).not.toHaveBeenCalled();
  });
});
