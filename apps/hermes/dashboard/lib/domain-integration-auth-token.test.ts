/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  AGENT_AUTH_API_URL: undefined as string | undefined,
  HERMES_INTERNAL_API_KEY: "internal-key-for-tests-32chars!!",
  HERMES_INTERNAL_API_KEY_PREVIOUS: undefined as string | undefined,
}));

const mockGetToken = vi.hoisted(() => vi.fn());
const mockFindFirst = vi.hoisted(() => vi.fn());
const mockDecrypt = vi.hoisted(() => vi.fn(() => "decrypted-api-key"));
const mockCreateAgentTokenClient = vi.hoisted(() => vi.fn());

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
  decryptDomainIntegrationApiKeyWithFallback: () => mockDecrypt(),
}));

vi.mock("@workspace/agent-auth-client", () => ({
  createAgentTokenClient: (...args: unknown[]) =>
    mockCreateAgentTokenClient(...args),
}));

const encryptedRow = { encryptedPayload: { ciphertext: '{"v":1}' } };

const TEN_MINUTES_MS = 10 * 60 * 1000;

const importTokenModule = async () => {
  const tokenModule = await import("./domain-integration-auth-token");

  return {
    ...tokenModule,
    createAgentTokenClient: mockCreateAgentTokenClient,
  };
};

const createDeferred = <Value>() => {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe("getBearerJwtForDomainIntegrationId", () => {
  beforeEach(() => {
    vi.resetModules();
    envState.AGENT_AUTH_API_URL = undefined;
    envState.HERMES_INTERNAL_API_KEY = "internal-key-for-tests-32chars!!";
    envState.HERMES_INTERNAL_API_KEY_PREVIOUS = undefined;
    mockGetToken.mockReset();
    mockFindFirst.mockReset();
    mockDecrypt.mockReset();
    mockDecrypt.mockReturnValue("decrypted-api-key");
    mockCreateAgentTokenClient.mockReset();
    mockCreateAgentTokenClient.mockImplementation(() => ({
      getToken: () => mockGetToken(),
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns undefined when AGENT_AUTH_API_URL is missing", async () => {
    // Setup
    const { getBearerJwtForDomainIntegrationId } = await importTokenModule();

    // Act
    const token = await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(token).toBeUndefined();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("returns undefined without caching when no encrypted key row exists", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(null);
    const { getBearerJwtForDomainIntegrationId } = await importTokenModule();

    // Act
    const firstToken = await getBearerJwtForDomainIntegrationId("int-1");
    const secondToken = await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(firstToken).toBeUndefined();
    expect(secondToken).toBeUndefined();
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it("mints a token using decrypted integration API key", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt-from-domain");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();

    // Act
    const token = await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(token).toBe("jwt-from-domain");
    expect(createAgentTokenClient).toHaveBeenCalledWith({
      authApiUrl: "http://auth",
      credential: "decrypted-api-key",
      fetchFn: expect.any(Function),
    });
  });

  it("reuses the token client across calls without reloading the credential", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("cached-jwt");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();

    // Act
    const firstToken = await getBearerJwtForDomainIntegrationId("int-1");
    const secondToken = await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(firstToken).toBe("cached-jwt");
    expect(secondToken).toBe("cached-jwt");
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockDecrypt).toHaveBeenCalledTimes(1);
    expect(createAgentTokenClient).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenCalledTimes(2);
  });

  it("keeps a separate cache entry per domain integration", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();

    // Act
    await getBearerJwtForDomainIntegrationId("int-1");
    await getBearerJwtForDomainIntegrationId("int-2");

    // Assert
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(createAgentTokenClient).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight token request between concurrent callers", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    const deferredToken = createDeferred<string>();
    mockGetToken.mockReturnValue(deferredToken.promise);
    const { getBearerJwtForDomainIntegrationId } = await importTokenModule();

    // Act
    const firstRequest = getBearerJwtForDomainIntegrationId("int-1");
    const secondRequest = getBearerJwtForDomainIntegrationId("int-1");
    deferredToken.resolve("shared-jwt");
    const tokens = await Promise.all([firstRequest, secondRequest]);

    // Assert
    expect(tokens).toEqual(["shared-jwt", "shared-jwt"]);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the credential for just under 10 minutes", async () => {
    // Setup
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T00:00:00.000Z"));
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();

    // Act
    await getBearerJwtForDomainIntegrationId("int-1");
    vi.setSystemTime(Date.now() + TEN_MINUTES_MS - 1);
    await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(createAgentTokenClient).toHaveBeenCalledTimes(1);
  });

  it("reloads the credential after 10 minutes and keeps the client when it is unchanged", async () => {
    // Setup
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T00:00:00.000Z"));
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();

    // Act
    await getBearerJwtForDomainIntegrationId("int-1");
    vi.setSystemTime(Date.now() + TEN_MINUTES_MS);
    await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(mockDecrypt).toHaveBeenCalledTimes(2);
    expect(createAgentTokenClient).toHaveBeenCalledTimes(1);
  });

  it("creates a new token client when the reloaded credential was rotated", async () => {
    // Setup
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T00:00:00.000Z"));
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockDecrypt
      .mockReturnValueOnce("original-api-key")
      .mockReturnValueOnce("rotated-api-key");
    mockGetToken.mockResolvedValue("jwt");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();

    // Act
    await getBearerJwtForDomainIntegrationId("int-1");
    vi.setSystemTime(Date.now() + TEN_MINUTES_MS);
    await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(createAgentTokenClient).toHaveBeenCalledTimes(2);
    expect(createAgentTokenClient).toHaveBeenLastCalledWith(
      expect.objectContaining({ credential: "rotated-api-key" }),
    );
  });

  it("bypasses the cache when a db is injected", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    const customFindFirst = vi.fn().mockResolvedValue(encryptedRow);
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt-from-custom-db");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();
    const options = {
      db: { domainIntegration: { findFirst: customFindFirst } },
    };

    // Act
    const firstToken = await getBearerJwtForDomainIntegrationId(
      "int-1",
      options,
    );
    await getBearerJwtForDomainIntegrationId("int-1", options);
    await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(firstToken).toBe("jwt-from-custom-db");
    expect(customFindFirst).toHaveBeenCalledTimes(2);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(createAgentTokenClient).toHaveBeenCalledTimes(3);
  });

  it("reloads the credential after the token is invalidated", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt");
    const {
      getBearerJwtForDomainIntegrationId,
      invalidateDomainIntegrationToken,
      createAgentTokenClient,
    } = await importTokenModule();

    // Act
    await getBearerJwtForDomainIntegrationId("int-1");
    invalidateDomainIntegrationToken("int-1");
    await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(createAgentTokenClient).toHaveBeenCalledTimes(2);
  });

  it("drops the cache entry when the token request fails", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken
      .mockRejectedValueOnce(new Error("auth down"))
      .mockResolvedValueOnce("recovered-jwt");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();

    // Act
    const failedError = await getBearerJwtForDomainIntegrationId("int-1").catch(
      (error: unknown) => error,
    );
    const recoveredToken = await getBearerJwtForDomainIntegrationId("int-1");

    // Assert
    expect((failedError as Error).message).toBe("auth down");
    expect(recoveredToken).toBe("recovered-jwt");
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(createAgentTokenClient).toHaveBeenCalledTimes(2);
  });

  it("sends the token request with a timeout signal", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();
    await getBearerJwtForDomainIntegrationId("int-1");
    const clientOptions = createAgentTokenClient.mock.calls[0]?.[0];

    // Act
    await clientOptions?.fetchFn?.("http://auth/api/token", {
      method: "POST",
    });

    // Assert
    const fetchInit = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(fetchInit.method).toBe("POST");
    expect(fetchInit.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(5_000);
  });

  it("reports a token request timeout as an auth API error", async () => {
    // Setup
    envState.AGENT_AUTH_API_URL = "http://auth";
    mockFindFirst.mockResolvedValue(encryptedRow);
    mockGetToken.mockResolvedValue("jwt");
    const timeoutError = new DOMException("timed out", "TimeoutError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeoutError));
    const { getBearerJwtForDomainIntegrationId, createAgentTokenClient } =
      await importTokenModule();
    await getBearerJwtForDomainIntegrationId("int-1");
    const clientOptions = createAgentTokenClient.mock.calls[0]?.[0];

    // Act
    const tokenRequest = clientOptions?.fetchFn?.("http://auth/api/token");

    // Assert
    await expect(tokenRequest).rejects.toThrow(
      "Agent auth API did not respond within 5s",
    );
  });
});
