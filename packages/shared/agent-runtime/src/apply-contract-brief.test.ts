import { describe, expect, it } from "vitest";

import { applyContractBrief } from "./apply-contract-brief.js";

describe("applyContractBrief", () => {
  it("returns systemContent unchanged when contract is undefined", () => {
    const result = applyContractBrief("You are a helpful agent.");
    expect(result).toBe("You are a helpful agent.");
  });

  it("returns systemContent unchanged when contract brief is empty string", () => {
    const result = applyContractBrief("Base prompt.", { brief: "" });
    expect(result).toBe("Base prompt.");
  });

  it("returns systemContent unchanged when contract brief is whitespace only", () => {
    const result = applyContractBrief("Base prompt.", { brief: "   " });
    expect(result).toBe("Base prompt.");
  });

  it("appends product_contract block when brief is present", () => {
    const result = applyContractBrief("You are a helpful agent.", {
      brief: "We produce a daily industry newsletter.",
    });
    expect(result).toBe(
      "You are a helpful agent.\n\n<product_contract>\nWe produce a daily industry newsletter.\n</product_contract>",
    );
  });

  it("trims leading/trailing whitespace from the brief", () => {
    const result = applyContractBrief("Prompt.", {
      brief: "  Trimmed brief.  ",
    });
    expect(result).toContain(
      "<product_contract>\nTrimmed brief.\n</product_contract>",
    );
  });

  it("preserves internal newlines in the brief", () => {
    const brief = "Line one.\nLine two.";
    const result = applyContractBrief("Prompt.", { brief });
    expect(result).toContain(
      "<product_contract>\nLine one.\nLine two.\n</product_contract>",
    );
  });
});
