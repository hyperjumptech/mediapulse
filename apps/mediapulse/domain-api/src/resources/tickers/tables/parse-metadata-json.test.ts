/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { parseTickerMetadataJson } from "./parse-metadata-json";

describe("parseTickerMetadataJson", () => {
  it("returns undefined when raw is undefined", () => {
    const result = parseTickerMetadataJson(undefined);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("returns null when raw is null", () => {
    const result = parseTickerMetadataJson(null);
    expect(result).toEqual({ ok: true, value: null });
  });

  it("returns null for empty or whitespace string", () => {
    expect(parseTickerMetadataJson("")).toEqual({ ok: true, value: null });
    expect(parseTickerMetadataJson("   ")).toEqual({ ok: true, value: null });
  });

  it("parses valid JSON strings", () => {
    const result = parseTickerMetadataJson('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ a: 1 });
    }
  });

  it("fails on invalid JSON string", () => {
    const result = parseTickerMetadataJson("{");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("metadata must be valid JSON");
    }
  });

  it("passes through object values", () => {
    const obj = { x: true };
    const result = parseTickerMetadataJson(obj);
    expect(result).toEqual({ ok: true, value: obj });
  });

  it("rejects non-object non-string primitives", () => {
    expect(parseTickerMetadataJson(42).ok).toBe(false);
    expect(parseTickerMetadataJson(true).ok).toBe(false);
  });
});
