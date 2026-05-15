import { describe, expect, it } from "vitest";

import { formatHermesHttpAsToolResult } from "./format-tool-result.js";

describe("formatHermesHttpAsToolResult", () => {
  it("returns success content for 2xx responses", () => {
    // Act
    const result = formatHermesHttpAsToolResult({
      status: 200,
      body: { label: "ci" },
      text: '{"label":"ci"}',
    });

    // Assert
    expect(result.isError).toBeUndefined();
    const content = result.content[0];
    expect(content?.type).toBe("text");
    if (content?.type !== "text") {
      throw new Error("expected text content");
    }
    expect(content.text).toContain('"status": 200');
    expect(content.text).toContain("ci");
  });

  it("marks 401 responses as tool errors with Hermes body", () => {
    // Act
    const result = formatHermesHttpAsToolResult({
      status: 401,
      body: { error: "Unauthorized" },
      text: '{"error":"Unauthorized"}',
    });

    // Assert
    expect(result.isError).toBe(true);
    const content = result.content[0];
    if (content?.type !== "text") {
      throw new Error("expected text content");
    }
    expect(content.text).toContain("Unauthorized");
  });
});
