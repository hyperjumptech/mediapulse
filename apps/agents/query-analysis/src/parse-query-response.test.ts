/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  parseQueryResponse,
  queryResponseSchema,
} from "./parse-query-response";

describe("parseQueryResponse", () => {
  it("parses valid query response JSON", () => {
    // Setup
    const raw = JSON.stringify({
      queries: [
        { text: "BBCA quarterly results", angle: "earnings" },
        { text: "Banking competition Indonesia", angle: "sector trend" },
      ],
    });

    // Act
    const parsed = parseQueryResponse(raw);

    // Assert
    expect(parsed.queries).toHaveLength(2);
    expect(parsed.queries[0]?.text).toBe("BBCA quarterly results");
  });

  it("throws for invalid JSON payload", () => {
    // Setup
    const raw = "{invalid-json";

    // Act
    const act = () => parseQueryResponse(raw);

    // Assert
    expect(act).toThrow("OpenAI returned invalid JSON for query-analysis");
  });

  it("throws when schema does not match", () => {
    // Setup
    const raw = JSON.stringify({
      queries: [{ text: "", angle: "x" }],
    });

    // Act
    const act = () => parseQueryResponse(raw);

    // Assert
    expect(act).toThrow();
  });
});

describe("queryResponseSchema", () => {
  it("accepts between one and fifteen queries", () => {
    // Setup
    const payload = {
      queries: Array.from({ length: 15 }, (_, index) => ({
        text: `query-${index + 1}`,
        angle: `angle-${index + 1}`,
      })),
    };

    // Act
    const parsed = queryResponseSchema.parse(payload);

    // Assert
    expect(parsed.queries).toHaveLength(15);
  });
});
