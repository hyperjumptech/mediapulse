/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  evaluateDetailBlockRule,
  parseDetailBlockRule,
  renderCaptionTemplate,
  renderUrlTemplate,
  resolvePath,
} from "./detail-block-rules";

describe("parseDetailBlockRule", () => {
  it("parses numeric comparison with operator", () => {
    const ast = parseDetailBlockRule("delivered < enabled");
    expect(ast.kind).toBe("compare");
    if (ast.kind !== "compare") return;
    expect(ast.operator).toBe("<");
  });

  it("parses present() and absent()", () => {
    expect(parseDetailBlockRule("present(activeQuerySet)").kind).toBe(
      "present",
    );
    expect(parseDetailBlockRule("absent(newsletter.runId)").kind).toBe(
      "absent",
    );
  });

  it("parses .length expressions", () => {
    const ast = parseDetailBlockRule("selectedSources.length == 0");
    expect(ast.kind).toBe("compare");
    if (ast.kind !== "compare") return;
    expect(ast.left.kind).toBe("length");
  });

  it("parses hoursBetween()", () => {
    const ast = parseDetailBlockRule(
      "hoursBetween(activeQuerySet.generatedAt, newsletter.createdAt) > 24",
    );
    expect(ast.kind).toBe("compare");
    if (ast.kind !== "compare") return;
    expect(ast.left.kind).toBe("hoursBetween");
  });

  it("rejects && and ||", () => {
    expect(() => parseDetailBlockRule("a && b")).toThrow(/boolean operators/i);
    expect(() => parseDetailBlockRule("a || b")).toThrow(/boolean operators/i);
  });

  it("rejects unsupported function calls", () => {
    expect(() => parseDetailBlockRule("foo(bar) == 1")).toThrow();
  });

  it("rejects invalid path syntax", () => {
    expect(() => parseDetailBlockRule("a-b < 5")).toThrow();
  });

  it("rejects empty expression", () => {
    expect(() => parseDetailBlockRule("  ")).toThrow();
  });
});

describe("evaluateDetailBlockRule", () => {
  it("evaluates path-to-path numeric comparison", () => {
    const ast = parseDetailBlockRule(
      "deliveryDelivered < deliveryEnabledAtSendTime",
    );
    expect(
      evaluateDetailBlockRule(ast, {
        deliveryDelivered: 1,
        deliveryEnabledAtSendTime: 5,
      }),
    ).toBe(true);
    expect(
      evaluateDetailBlockRule(ast, {
        deliveryDelivered: 5,
        deliveryEnabledAtSendTime: 5,
      }),
    ).toBe(false);
  });

  it("evaluates .length comparison against arrays and strings", () => {
    const ast = parseDetailBlockRule("selectedSources.length == 0");
    expect(evaluateDetailBlockRule(ast, { selectedSources: [] })).toBe(true);
    expect(evaluateDetailBlockRule(ast, { selectedSources: [1] })).toBe(false);
  });

  it("evaluates present()/absent()", () => {
    const present = parseDetailBlockRule("present(value)");
    expect(evaluateDetailBlockRule(present, { value: 42 })).toBe(true);
    expect(evaluateDetailBlockRule(present, { value: null })).toBe(false);

    const absent = parseDetailBlockRule("absent(value)");
    expect(evaluateDetailBlockRule(absent, { value: null })).toBe(true);
    expect(evaluateDetailBlockRule(absent, { value: 1 })).toBe(false);
  });

  it("evaluates equality with string literal", () => {
    const ast = parseDetailBlockRule('status == "failed"');
    expect(evaluateDetailBlockRule(ast, { status: "failed" })).toBe(true);
    expect(evaluateDetailBlockRule(ast, { status: "ok" })).toBe(false);
  });

  it("evaluates hoursBetween()", () => {
    const ast = parseDetailBlockRule("hoursBetween(a, b) > 24");
    expect(
      evaluateDetailBlockRule(ast, {
        a: "2026-05-01T00:00:00Z",
        b: "2026-05-03T00:00:00Z",
      }),
    ).toBe(true);
    expect(
      evaluateDetailBlockRule(ast, {
        a: "2026-05-01T00:00:00Z",
        b: "2026-05-01T12:00:00Z",
      }),
    ).toBe(false);
  });

  it("returns false when operand is missing rather than throwing", () => {
    const ast = parseDetailBlockRule("a < b");
    expect(evaluateDetailBlockRule(ast, { a: 1 })).toBe(false);
  });

  it("returns false for comparisons on non-numeric values", () => {
    const ast = parseDetailBlockRule("a < b");
    expect(evaluateDetailBlockRule(ast, { a: "x", b: "y" })).toBe(false);
  });
});

describe("resolvePath", () => {
  it("resolves dotted paths", () => {
    expect(resolvePath({ a: { b: { c: 1 } } }, "a.b.c")).toBe(1);
  });

  it("returns undefined for missing segments", () => {
    expect(resolvePath({ a: 1 }, "a.b.c")).toBeUndefined();
  });

  it("returns the entire value for an empty path", () => {
    expect(resolvePath({ a: 1 }, "")).toEqual({ a: 1 });
  });
});

describe("renderUrlTemplate", () => {
  it("substitutes placeholders", () => {
    expect(renderUrlTemplate("/x/{a}/y/{b}", { a: "one", b: "two" })).toBe(
      "/x/one/y/two",
    );
  });

  it("URL-encodes values", () => {
    expect(renderUrlTemplate("/x/{a}", { a: "hello world" })).toBe(
      "/x/hello%20world",
    );
  });

  it("returns undefined when any placeholder is missing", () => {
    expect(renderUrlTemplate("/x/{a}/{b}", { a: "one" })).toBeUndefined();
  });

  it("passes through absolute http(s) URLs without re-encoding", () => {
    expect(
      renderUrlTemplate("{url}", { url: "https://example.com/aapl?q=1" }),
    ).toBe("https://example.com/aapl?q=1");
  });
});

describe("renderCaptionTemplate", () => {
  it("substitutes .length and other paths", () => {
    expect(
      renderCaptionTemplate("Citations ({citations.length} unique)", {
        citations: [1, 2, 3],
      }),
    ).toBe("Citations (3 unique)");
  });

  it("renders missing placeholders as empty string", () => {
    expect(renderCaptionTemplate("Hello {name}", {})).toBe("Hello ");
  });
});
