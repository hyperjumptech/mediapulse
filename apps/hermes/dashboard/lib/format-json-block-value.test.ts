import { describe, expect, it } from "vitest";

import { formatJsonBlockValue } from "./format-json-block-value";

describe("formatJsonBlockValue", () => {
  it("returns null for null and undefined", () => {
    const formattedNull = formatJsonBlockValue(null);
    const formattedUndefined = formatJsonBlockValue(undefined);

    expect(formattedNull).toBeNull();
    expect(formattedUndefined).toBeNull();
  });

  it("pretty prints objects and arrays with two-space indentation", () => {
    const formattedObject = formatJsonBlockValue({ a: 1, b: [true] });
    const formattedArray = formatJsonBlockValue([1, "two"]);

    expect(formattedObject).toBe('{\n  "a": 1,\n  "b": [\n    true\n  ]\n}');
    expect(formattedArray).toBe('[\n  1,\n  "two"\n]');
  });

  it("keeps an already formatted string as it is", () => {
    const preformatted = '{\n  "method": "POST"\n}';

    const formatted = formatJsonBlockValue(preformatted);

    expect(formatted).toBe(preformatted);
  });

  it("serializes numbers and booleans as JSON", () => {
    const formattedNumber = formatJsonBlockValue(42);
    const formattedBoolean = formatJsonBlockValue(false);

    expect(formattedNumber).toBe("42");
    expect(formattedBoolean).toBe("false");
  });

  it("falls back to String for values JSON cannot serialize", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const formattedBigInt = formatJsonBlockValue(BigInt(7));
    const formattedCircular = formatJsonBlockValue(circular);
    const formattedSymbol = formatJsonBlockValue(Symbol("marker"));

    expect(formattedBigInt).toBe("7");
    expect(formattedCircular).toBe("[object Object]");
    expect(formattedSymbol).toBe("Symbol(marker)");
  });
});
