import { describe, expect, it } from "vitest";

import {
  findRunParamKeys,
  isReservedVariableKey,
  parseRunParams,
  RUN_PARAMS_MAX_KEYS,
  RUN_PARAMS_MAX_STRING_LENGTH,
  substituteRunParams,
} from "./run-params";

describe("parseRunParams", () => {
  it("treats a missing value as no params", () => {
    expect(parseRunParams(undefined)).toEqual({ success: true, params: {} });
    expect(parseRunParams(null)).toEqual({ success: true, params: {} });
  });

  it("accepts flat string, number and boolean values", () => {
    const result = parseRunParams({ itemId: "abc", limit: 5, force: true });

    expect(result).toEqual({
      success: true,
      params: { itemId: "abc", limit: 5, force: true },
    });
  });

  it("rejects nested values", () => {
    const result = parseRunParams({ itemId: { nested: true } });

    expect(result.success).toBe(false);
  });

  it("rejects arrays and primitives", () => {
    expect(parseRunParams(["a"]).success).toBe(false);
    expect(parseRunParams("itemId").success).toBe(false);
  });

  it("rejects keys that are not identifiers", () => {
    expect(parseRunParams({ "item.id": "a" }).success).toBe(false);
    expect(parseRunParams({ "1item": "a" }).success).toBe(false);
  });

  it("rejects too many keys", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: RUN_PARAMS_MAX_KEYS + 1 }, (_, index) => [
        `key${index}`,
        index,
      ]),
    );

    expect(parseRunParams(tooMany).success).toBe(false);
  });

  it("rejects strings over the length cap", () => {
    const longValue = "x".repeat(RUN_PARAMS_MAX_STRING_LENGTH + 1);

    expect(parseRunParams({ itemId: longValue }).success).toBe(false);
  });

  it("rejects non-finite numbers", () => {
    expect(parseRunParams({ limit: Number.POSITIVE_INFINITY }).success).toBe(
      false,
    );
  });
});

describe("substituteRunParams", () => {
  it("keeps the value type when the whole string is one placeholder", () => {
    const result = substituteRunParams(
      { itemId: "{{params.itemId}}", limit: "{{ params.limit }}" },
      { itemId: "abc", limit: 5 },
    );

    expect(result).toEqual({ itemId: "abc", limit: 5 });
  });

  it("stringifies values embedded in a longer string", () => {
    const result = substituteRunParams(
      { path: "items/{{params.itemId}}?force={{params.force}}" },
      { itemId: "abc", force: false },
    );

    expect(result).toEqual({ path: "items/abc?force=false" });
  });

  it("walks nested objects and arrays", () => {
    const result = substituteRunParams(
      { list: ["{{params.itemId}}", { deep: "{{params.itemId}}" }] },
      { itemId: "abc" },
    );

    expect(result).toEqual({ list: ["abc", { deep: "abc" }] });
  });

  it("leaves unknown params and plain variables untouched", () => {
    const result = substituteRunParams(
      { first: "{{params.missing}}", second: "{{API_KEY}}" },
      { itemId: "abc" },
    );

    expect(result).toEqual({
      first: "{{params.missing}}",
      second: "{{API_KEY}}",
    });
  });
});

describe("findRunParamKeys", () => {
  it("returns every referenced run parameter once, sorted", () => {
    const keys = findRunParamKeys({
      first: "{{params.itemId}}",
      second: ["x {{params.limit}} {{params.itemId}}"],
      third: "{{API_KEY}}",
    });

    expect(keys).toEqual(["itemId", "limit"]);
  });

  it("returns nothing when no run parameter is referenced", () => {
    expect(findRunParamKeys({ value: 1, text: "{{API_KEY}}" })).toEqual([]);
  });
});

describe("isReservedVariableKey", () => {
  it("reserves the params prefix", () => {
    expect(isReservedVariableKey("params.itemId")).toBe(true);
    expect(isReservedVariableKey("PARAMS_KEY")).toBe(false);
  });
});
