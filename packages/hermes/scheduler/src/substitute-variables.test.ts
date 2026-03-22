import { describe, expect, it } from "vitest";
import {
  substituteInString,
  substituteVariables,
} from "./substitute-variables";

describe("substituteInString", () => {
  it("replaces single placeholder with variable value", () => {
    const variables = new Map([["KEY", "value1"]]);
    expect(substituteInString("hello {{KEY}}", variables)).toBe("hello value1");
  });

  it("replaces multiple same placeholder", () => {
    const variables = new Map([["X", "ok"]]);
    expect(substituteInString("{{X}} and {{X}}", variables)).toBe("ok and ok");
  });

  it("replaces multiple different placeholders", () => {
    const variables = new Map([
      ["HOST", "api.example.com"],
      ["PATH", "v1/users"],
    ]);
    expect(substituteInString("https://{{HOST}}/{{PATH}}", variables)).toBe(
      "https://api.example.com/v1/users",
    );
  });

  it("leaves unknown key as placeholder", () => {
    const variables = new Map([["KNOWN", "yes"]]);
    expect(substituteInString("{{KNOWN}} {{UNKNOWN}}", variables)).toBe(
      "yes {{UNKNOWN}}",
    );
  });

  it("returns original string when no placeholders", () => {
    const variables = new Map([["KEY", "v"]]);
    expect(substituteInString("no placeholders", variables)).toBe(
      "no placeholders",
    );
  });

  it("trims key when replacing", () => {
    const variables = new Map([["KEY", "v"]]);
    expect(substituteInString("{{  KEY  }}", variables)).toBe("v");
  });
});

describe("substituteVariables", () => {
  const variables = new Map([
    ["API_KEY", "secret123"],
    ["URL", "https://api.example.com"],
  ]);

  it("substitutes in nested object strings", () => {
    const obj = {
      apiKey: "{{API_KEY}}",
      nested: { url: "{{URL}}" },
    };
    expect(substituteVariables(obj, variables)).toEqual({
      apiKey: "secret123",
      nested: { url: "https://api.example.com" },
    });
  });

  it("substitutes in array of strings", () => {
    const obj = ["{{API_KEY}}", "literal", "{{URL}}"];
    expect(substituteVariables(obj, variables)).toEqual([
      "secret123",
      "literal",
      "https://api.example.com",
    ]);
  });

  it("substitutes in mixed nested structure", () => {
    const obj = {
      a: [{ x: "{{API_KEY}}" }, { y: "{{URL}}" }],
    };
    expect(substituteVariables(obj, variables)).toEqual({
      a: [{ x: "secret123" }, { y: "https://api.example.com" }],
    });
  });

  it("returns primitives unchanged", () => {
    expect(substituteVariables(42, variables)).toBe(42);
    expect(substituteVariables(null, variables)).toBe(null);
    expect(substituteVariables(true, variables)).toBe(true);
  });

  it("substitutes single string", () => {
    expect(substituteVariables("{{API_KEY}}", variables)).toBe("secret123");
  });

  it("leaves unknown placeholder in string", () => {
    const obj = { key: "{{MISSING}}" };
    expect(substituteVariables(obj, variables)).toEqual({
      key: "{{MISSING}}",
    });
  });
});
