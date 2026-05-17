import { describe, expect, it } from "vitest";

import {
  buildRequestBodyForSpec,
  extractListSearchParams,
  HERMES_READ_TOOL_SPECS,
  resolvePathTemplate,
} from "./tool-catalog.js";

describe("resolvePathTemplate", () => {
  it("substitutes path parameters", () => {
    // Act
    const path = resolvePathTemplate(
      "/api/agents/{agentId}/{agentVersion}/schemas",
      { agentId: "article-analysis", agentVersion: "1.0.0" },
    );

    // Assert
    expect(path).toBe("/api/agents/article-analysis/1.0.0/schemas");
  });

  it("throws when a path parameter is missing", () => {
    expect(() =>
      resolvePathTemplate("/api/pipelines/{pipelineId}/schemas", {}),
    ).toThrow("Missing path parameter: pipelineId");
  });
});

describe("buildRequestBodyForSpec", () => {
  it("builds variable get body", () => {
    const spec = HERMES_READ_TOOL_SPECS.find(
      (s) => s.name === "hermes_get_variable",
    );
    expect(spec).toBeDefined();

    // Act
    const body = buildRequestBodyForSpec(spec!, {
      id: "550e8400-e29b-41d4-a716-446655440000",
    });

    // Assert
    expect(body).toEqual({
      id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });
});

describe("extractListSearchParams", () => {
  it("extracts pagination and filters", () => {
    // Act
    const params = extractListSearchParams({
      limit: 25,
      cursor: "next",
      outcome: "failure",
      tickerId: "AAPL",
      agentId: "ignored",
    });

    // Assert
    expect(params).toEqual({
      limit: 25,
      cursor: "next",
      outcome: "failure",
      tickerId: "AAPL",
    });
  });
});

describe("HERMES_READ_TOOL_SPECS", () => {
  it("includes hermes_ping mapped to whoami", () => {
    const ping = HERMES_READ_TOOL_SPECS.find((s) => s.name === "hermes_ping");
    expect(ping?.method).toBe("GET");
    expect(ping?.pathTemplate).toBe("/api/mcp/whoami");
  });

  it("uses unique tool names", () => {
    const names = HERMES_READ_TOOL_SPECS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
