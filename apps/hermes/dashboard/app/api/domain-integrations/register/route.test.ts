/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

const registerDomainIntegrationMock = vi.fn();
const invalidateDomainIntegrationTokenMock = vi.fn();

vi.mock("@hermes/env", () => ({
  env: { AGENT_AUTH_API_URL: "http://auth.test" },
}));

vi.mock("@/lib/domain-integrations", () => ({
  registerDomainIntegration: (...args: unknown[]) =>
    registerDomainIntegrationMock(...args),
}));

vi.mock("@/lib/domain-integration-auth-token", () => ({
  invalidateDomainIntegrationToken: (...args: unknown[]) =>
    invalidateDomainIntegrationTokenMock(...args),
}));

vi.mock("@hermes/domain-contract", () => ({
  registerDomainIntegrationRequestSchema: {
    safeParse: (value: unknown) => ({ success: true, data: value }),
  },
  registerDomainIntegrationResponseSchema: {
    parse: (value: unknown) => value,
  },
}));

import { POST } from "./route";

const registerRequest = (headers: Record<string, string> = {}) =>
  new Request("http://hermes.test/api/domain-integrations/register", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ integrationId: "mediapulse" }),
  });

describe("POST /api/domain-integrations/register", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("drops the cached token for the integration after registering", async () => {
    // Setup
    registerDomainIntegrationMock.mockResolvedValue({
      id: "integration-row-1",
      integrationId: "mediapulse",
    });

    // Act
    const response = await POST(
      registerRequest({ authorization: "Bearer api-key" }),
    );

    // Assert
    expect(response.status).toBe(200);
    expect(registerDomainIntegrationMock).toHaveBeenCalledWith(
      { integrationId: "mediapulse" },
      "api-key",
    );
    expect(invalidateDomainIntegrationTokenMock).toHaveBeenCalledWith(
      "integration-row-1",
    );
  });

  it("rejects a request without a bearer key", async () => {
    // Act
    const response = await POST(registerRequest());

    // Assert
    expect(response.status).toBe(401);
    expect(registerDomainIntegrationMock).not.toHaveBeenCalled();
  });

  it("keeps the cached token when registration fails", async () => {
    // Setup
    registerDomainIntegrationMock.mockRejectedValue(new Error("bad key"));

    // Act
    const response = await POST(
      registerRequest({ authorization: "Bearer wrong" }),
    );

    // Assert
    expect(response.status).toBe(401);
    expect(invalidateDomainIntegrationTokenMock).not.toHaveBeenCalled();
  });
});
