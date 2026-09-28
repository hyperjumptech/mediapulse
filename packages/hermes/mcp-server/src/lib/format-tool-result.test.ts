import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";

import {
  capToolText,
  formatHermesHttpAsToolResult,
  formatHermesListAsToolResult,
  formatHermesToolError,
  MAX_TOOL_TEXT_CHARACTERS,
  parsePaginatedListBody,
} from "./format-tool-result.js";

const readText = (result: CallToolResult): string => {
  const content = result.content[0];
  if (content?.type !== "text") {
    throw new Error("expected text content");
  }

  return content.text;
};

const httpResponse = (status: number, body: unknown) => ({
  status,
  body,
  text: JSON.stringify(body),
});

describe("formatHermesHttpAsToolResult", () => {
  it("returns compact JSON of the body without a status wrapper", () => {
    const result = formatHermesHttpAsToolResult(
      httpResponse(200, { label: "ci", readOnly: false }),
    );

    expect(result.isError).toBeUndefined();
    expect(readText(result)).toBe('{"label":"ci","readOnly":false}');
  });

  it("returns plain text bodies unchanged", () => {
    expect(
      readText(formatHermesHttpAsToolResult(httpResponse(200, "ok"))),
    ).toBe("ok");
  });

  it("keeps the status and body on HTTP errors", () => {
    const result = formatHermesHttpAsToolResult(
      httpResponse(401, { error: "Unauthorized" }),
    );

    expect(result.isError).toBe(true);
    expect(readText(result)).toBe(
      '{"status":401,"body":{"error":"Unauthorized"}}',
    );
  });

  it("treats status 0 (network or profile failure) as an error", () => {
    expect(
      formatHermesHttpAsToolResult(httpResponse(0, { error: "No profile" }))
        .isError,
    ).toBe(true);
  });

  it("caps long output and ends it with a narrowing hint", () => {
    const result = formatHermesHttpAsToolResult(
      httpResponse(200, { value: "x".repeat(500) }),
      { maxCharacters: 300 },
    );

    const text = readText(result);
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text).toMatch(/pageSize, a q search, or a hermes_get_\* tool/);
  });
});

describe("capToolText", () => {
  it("leaves text under the limit untouched", () => {
    expect(capToolText("short", 10)).toBe("short");
  });

  it("defaults to a limit of about 50,000 characters", () => {
    const text = capToolText("y".repeat(MAX_TOOL_TEXT_CHARACTERS + 1));

    expect(MAX_TOOL_TEXT_CHARACTERS).toBe(50_000);
    expect(text.length).toBeLessThanOrEqual(MAX_TOOL_TEXT_CHARACTERS);
    expect(text).toContain("[Truncated at 50000 of 50001 characters.");
  });
});

describe("parsePaginatedListBody", () => {
  it("derives hasMore when an older dashboard omits it", () => {
    expect(
      parsePaginatedListBody({ items: [], total: 21, page: 1, pageSize: 20 }),
    ).toEqual({ items: [], total: 21, page: 1, pageSize: 20, hasMore: true });
  });

  it("rejects bodies that are not paginated lists", () => {
    expect(parsePaginatedListBody({ results: [] })).toBeUndefined();
    expect(parsePaginatedListBody(null)).toBeUndefined();
  });
});

describe("formatHermesListAsToolResult", () => {
  it("returns compact text and matching structured content", () => {
    const body = {
      items: [{ id: "a" }],
      total: 3,
      page: 1,
      pageSize: 1,
      hasMore: true,
    };

    const result = formatHermesListAsToolResult(httpResponse(200, body));

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(body);
    expect(readText(result)).toBe(JSON.stringify(body));
  });

  it("drops trailing items to stay under the limit and marks the result truncated", () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      id: `row-${index}`,
      payload: "z".repeat(100),
    }));
    const body = { items, total: 40, page: 1, pageSize: 20, hasMore: true };

    const result = formatHermesListAsToolResult(httpResponse(200, body), {
      maxCharacters: 1_000,
    });

    const text = readText(result);
    const structured = result.structuredContent as {
      items: unknown[];
      truncated?: boolean;
      total: number;
    };
    expect(text.length).toBeLessThanOrEqual(1_000);
    expect(structured.truncated).toBe(true);
    expect(structured.total).toBe(40);
    expect(structured.items.length).toBeGreaterThan(0);
    expect(structured.items.length).toBeLessThan(20);
    expect(text).toContain(
      `[Truncated: showing ${structured.items.length} of 20 items on this page`,
    );
  });

  it("keeps the status and body on HTTP errors without structured content", () => {
    const result = formatHermesListAsToolResult(
      httpResponse(403, { code: "forbidden" }),
    );

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(readText(result)).toBe('{"status":403,"body":{"code":"forbidden"}}');
  });

  it("reports a tool error when the body is not a paginated list", () => {
    const result = formatHermesListAsToolResult(
      httpResponse(200, { results: [] }),
    );

    expect(result.isError).toBe(true);
    expect(readText(result)).toContain("not a paginated list");
  });
});

describe("formatHermesToolError", () => {
  it("returns compact JSON with optional details", () => {
    const result = formatHermesToolError("Blocked", {
      requiredField: "confirm",
    });

    expect(result.isError).toBe(true);
    expect(readText(result)).toBe(
      '{"error":"Blocked","details":{"requiredField":"confirm"}}',
    );
  });
});
