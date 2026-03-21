/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { createDomainIntegrationClient } from "./client";

/**
 * Creates a Fetch API response carrying JSON.
 *
 * @param body - Response body object.
 * @param status - HTTP status code.
 * @returns Response instance.
 */
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("createDomainIntegrationClient", () => {
  it("calls health endpoint and parses response", async () => {
    // Setup
    const fetchImpl: typeof fetch = async (input) => {
      expect(String(input)).toBe("https://domain.example/v1/health");
      return jsonResponse({
        ok: true,
        service: "mediapulse",
        version: "1.0.0",
      });
    };
    const client = createDomainIntegrationClient({
      baseUrl: "https://domain.example",
      fetchImpl,
    });

    // Act
    const result = await client.health();

    // Assert
    expect(result).toEqual({
      ok: true,
      service: "mediapulse",
      version: "1.0.0",
    });
  });

  it("calls preview endpoint with auth header", async () => {
    // Setup
    const fetchImpl: typeof fetch = async (_input, init) => {
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toBe(
        "Bearer token-123",
      );
      return jsonResponse({ success: true, values: ["a", "b"] });
    };
    const client = createDomainIntegrationClient({
      baseUrl: "https://domain.example",
      authToken: "token-123",
      fetchImpl,
    });

    // Act
    const result = await client.previewExpansion({
      expansionString: "db:ticker:id",
    });

    // Assert
    expect(result).toEqual({ success: true, values: ["a", "b"] });
  });

  it("throws on non-200 expand response", async () => {
    // Setup
    const fetchImpl: typeof fetch = async () =>
      jsonResponse({ error: "bad" }, 500);
    const client = createDomainIntegrationClient({
      baseUrl: "https://domain.example",
      fetchImpl,
    });

    // Act / Assert
    await expect(
      client.expandStepInputs({ input: { tickerId: "db:ticker:id" } }),
    ).rejects.toThrow("Expand request failed with status 500");
  });
});
