/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  registerDomainIntegrationRequestSchema,
  tableV1ListResponseSchema,
} from "./contracts";

describe("registerDomainIntegrationRequestSchema", () => {
  it("defaults dashboard manifest when omitted", () => {
    // Act
    const parsed = registerDomainIntegrationRequestSchema.parse({
      key: "mediapulse",
      name: "Mediapulse",
      baseUrl: "https://domain.example",
      capabilities: [],
    });

    // Assert
    expect(parsed.dashboard).toEqual({
      templateVersion: 1,
      pages: [],
    });
  });
});

describe("tableV1ListResponseSchema", () => {
  it("parses a valid table-v1 list payload", () => {
    // Act
    const parsed = tableV1ListResponseSchema.parse({
      items: [{ id: "1", name: "AAPL" }],
      total: 1,
      page: 1,
      pageSize: 15,
    });

    // Assert
    expect(parsed.total).toBe(1);
    expect(parsed.items).toHaveLength(1);
  });
});
