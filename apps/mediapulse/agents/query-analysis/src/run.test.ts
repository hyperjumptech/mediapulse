/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

vi.mock("@mediapulse/env/agents-query-analysis", () => ({
  env: {
    AGENT_DATA_API_URL: "http://agent-data-api",
    AGENT_AUTH_API_URL: "http://agent-auth-api",
    OPENAI_API_KEY: "test",
  },
}));

import { buildDeterministicQueries } from "./run";

describe("buildDeterministicQueries", () => {
  it("creates deterministic baseline queries", () => {
    // Act
    const queries = buildDeterministicQueries("AAPL", "Apple Inc.");

    // Assert
    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0]?.text).toContain("AAPL");
    expect(queries.some((query) => query.intent === "fundamental")).toBe(true);
  });
});
