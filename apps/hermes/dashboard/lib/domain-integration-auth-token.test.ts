/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  AGENT_AUTH_API_URL: undefined as string | undefined,
  HERMES_INTERNAL_API_KEY: "internal-key-for-tests-32chars!!",
  HERMES_INTERNAL_API_KEY_PREVIOUS: undefined as string | undefined,
}));

const mockGetToken = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());

vi.mock("@hermes/env", () => ({
  get env() {
    return envState;
  },
}));

vi.mock("@hermes/orchestration-database", () => ({
  DomainIntegrationStatus: { active: "active" },
  prisma: {
    domainIntegration: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock("@hermes/domain-integration-crypto", () => ({
  decryptDomainIntegrationApiKeyWithFallback: vi.fn(() => "decrypted-api-key"),
}));

vi.mock("@workspace/agent-auth-client", () => ({
  createAgentTokenClient: vi.fn(() => ({
    getToken: () => mockGetToken(),
  })),
}));

describe("getBearerJwtForDomainIntegrationId", () => {
  beforeEach(() => {
    envState.AGENT_AUTH_API_URL = undefined;
    envState.HERMES_INTERNAL_API_KEY = "internal-key-for-tests-32chars!!";
    envState.HERMES_INTERNAL_API_KEY_PREVIOUS = undefined;
    mockGetToken.mockReset();
    mockFindFirst.mockReset();
    vi.clearAllMocks();
  });

  it("returns undefined when AGENT_AUTH_API_URL is missing", async () => {
    const { getBearerJwtForDomainIntegrationId } =
      await import("./domain-integration-auth-token");

    await expect(
      getBearerJwtForDomainIntegrationId("int-1"),
    ).resolves.toBeUndefined();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns undefined when no encrypted key row exists", async () => {
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(null);

    const { getBearerJwtForDomainIntegrationId } =
      await import("./domain-integration-auth-token");

    await expect(
      getBearerJwtForDomainIntegrationId("int-1"),
    ).resolves.toBeUndefined();
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("mints a token using decrypted integration API key", async () => {
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue({
      encryptedPayload: { ciphertext: '{"v":1}' },
    });
    mockGetToken.mockResolvedValue("jwt-from-domain");

    const { createAgentTokenClient } =
      await import("@workspace/agent-auth-client");
    const { getBearerJwtForDomainIntegrationId } =
      await import("./domain-integration-auth-token");

    await expect(getBearerJwtForDomainIntegrationId("int-1")).resolves.toBe(
      "jwt-from-domain",
    );

    expect(createAgentTokenClient).toHaveBeenCalledWith({
      authApiUrl: "http://auth",
      credential: "decrypted-api-key",
    });
  });

  it("uses injected db when provided", async () => {
    envState.AGENT_AUTH_API_URL = "http://auth";
    const customFindFirst = vi.fn().mockResolvedValue({
      encryptedApiKey: '{"v":1}',
    });
    mockGetToken.mockResolvedValue("jwt-from-custom-db");

    const { getBearerJwtForDomainIntegrationId } =
      await import("./domain-integration-auth-token");

    await expect(
      getBearerJwtForDomainIntegrationId("int-1", {
        db: { domainIntegration: { findFirst: customFindFirst } },
      }),
    ).resolves.toBe("jwt-from-custom-db");

    expect(customFindFirst).toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
