/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DomainIntegrationTimeoutError,
  requestDomainIntegration,
  type DomainIntegrationRequest,
} from "./domain-integration-request";

const getBearerJwtMock = vi.hoisted(() => vi.fn());
const invalidateTokenMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/domain-integration-auth-token", () => ({
  getBearerJwtForDomainIntegrationId: (...args: unknown[]) =>
    getBearerJwtMock(...args),
  invalidateDomainIntegrationToken: (...args: unknown[]) =>
    invalidateTokenMock(...args),
}));

const buildRequest = (
  overrides: Partial<DomainIntegrationRequest> = {},
): DomainIntegrationRequest => ({
  url: "http://domain.test/v1/items",
  domainIntegrationId: "di-1",
  integrationLabel: "mediapulse",
  ...overrides,
});

const readStatus = async (response: Response) => response.status;

const authorizationHeaderOf = (
  fetchMock: ReturnType<typeof vi.fn>,
  call = 0,
) => {
  const init = fetchMock.mock.calls[call]?.[1] as RequestInit;

  return new Headers(init.headers).get("Authorization");
};

describe("requestDomainIntegration", () => {
  beforeEach(() => {
    getBearerJwtMock.mockReset();
    invalidateTokenMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the bearer token with no-store caching and a read timeout", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt-1");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

    // Act
    const status = await requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      readStatus,
    );

    // Assert
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(status).toBe(200);
    expect(authorizationHeaderOf(fetchMock)).toBe("Bearer jwt-1");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
  });

  it("uses the longer write timeout for non-GET requests", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt-1");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

    // Act
    await requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock, init: { method: "PATCH" } }),
      readStatus,
    );

    // Assert
    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
  });

  it("omits the Authorization header when no token is available", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));

    // Act
    await requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      readStatus,
    );

    // Assert
    expect(authorizationHeaderOf(fetchMock)).toBeNull();
  });

  it("invalidates the token and retries once with a fresh token on 401", async () => {
    // Setup
    getBearerJwtMock
      .mockResolvedValueOnce("stale-jwt")
      .mockResolvedValueOnce("fresh-jwt");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    // Act
    const status = await requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      readStatus,
    );

    // Assert
    expect(status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(invalidateTokenMock).toHaveBeenCalledWith("di-1");
    expect(authorizationHeaderOf(fetchMock, 0)).toBe("Bearer stale-jwt");
    expect(authorizationHeaderOf(fetchMock, 1)).toBe("Bearer fresh-jwt");
  });

  it("returns the second 401 without retrying again", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt");
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response("no", { status: 401 }));

    // Act
    const status = await requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      readStatus,
    );

    // Assert
    expect(status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(invalidateTokenMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 401 when the request carried no token", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue(undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("no", { status: 401 }));

    // Act
    const status = await requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      readStatus,
    );

    // Assert
    expect(status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(invalidateTokenMock).not.toHaveBeenCalled();
  });

  it("maps a fetch timeout to a clear read timeout error", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt");
    const timeoutError = new DOMException("timed out", "TimeoutError");
    const fetchMock = vi.fn().mockRejectedValue(timeoutError);

    // Act
    const request = requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      readStatus,
    );

    // Assert
    await expect(request).rejects.toBeInstanceOf(DomainIntegrationTimeoutError);
    await expect(request).rejects.toThrow(
      'Domain integration "mediapulse" did not respond within 10s',
    );
  });

  it("maps an abort during a write to the write timeout message", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt");
    const abortError = new DOMException("aborted", "AbortError");
    const fetchMock = vi.fn().mockRejectedValue(abortError);

    // Act
    const request = requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock, init: { method: "POST" } }),
      readStatus,
    );

    // Assert
    await expect(request).rejects.toThrow(
      'Domain integration "mediapulse" did not respond within 30s',
    );
  });

  it("maps a timeout while reading the response body", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    const timeoutError = new DOMException("timed out", "TimeoutError");

    // Act
    const request = requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      async () => {
        throw timeoutError;
      },
    );

    // Assert
    await expect(request).rejects.toThrow(
      'Domain integration "mediapulse" did not respond within 10s',
    );
  });

  it("passes non-timeout errors through unchanged", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt");
    const networkError = new TypeError("fetch failed");
    const fetchMock = vi.fn().mockRejectedValue(networkError);

    // Act
    const request = requestDomainIntegration(
      buildRequest({ fetchImpl: fetchMock }),
      readStatus,
    );

    // Assert
    await expect(request).rejects.toBe(networkError);
  });
});
