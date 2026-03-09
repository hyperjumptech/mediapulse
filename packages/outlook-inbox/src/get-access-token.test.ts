import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAccessTokenFromClientCredentials,
  type ClientCredentialsConfig,
} from "./get-access-token.js";

vi.mock("got", () => ({
  default: { post: vi.fn() },
}));

describe("getAccessTokenFromClientCredentials", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends correct URL and form body and returns access_token", async () => {
    // Setup
    const config: ClientCredentialsConfig = {
      clientId: "client-1",
      clientSecret: "secret-1",
      tenantId: "tenant-1",
    };
    const requestFn = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ access_token: "token-abc" }),
    });

    // Act
    const result = await getAccessTokenFromClientCredentials(config, {
      requestFn,
    });

    // Assert
    expect(requestFn).toHaveBeenCalledTimes(1);
    const [url, opts] = requestFn.mock.calls[0] as [
      string,
      { body: string; headers: Record<string, string> },
    ];
    expect(url).toBe(
      "https://login.microsoftonline.com/tenant-1/oauth2/v2.0/token",
    );
    expect(opts.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const params = new URLSearchParams(opts.body);
    expect(params.get("grant_type")).toBe("client_credentials");
    expect(params.get("client_id")).toBe("client-1");
    expect(params.get("client_secret")).toBe("secret-1");
    expect(params.get("scope")).toContain("graph.microsoft.com");
    expect(result).toBe("token-abc");
  });

  it("throws when status is not 2xx", async () => {
    // Setup
    const config: ClientCredentialsConfig = {
      clientId: "c",
      clientSecret: "s",
      tenantId: "t",
    };
    const requestFn = vi.fn().mockResolvedValue({
      statusCode: 401,
      body: JSON.stringify({
        error: "invalid_client",
        error_description: "Bad secret",
      }),
    });

    // Act & Assert
    await expect(
      getAccessTokenFromClientCredentials(config, { requestFn }),
    ).rejects.toThrow("Token request failed: 401");
    await expect(
      getAccessTokenFromClientCredentials(config, { requestFn }),
    ).rejects.toThrow("Bad secret");
  });

  it("throws when response body has no access_token", async () => {
    // Setup
    const config: ClientCredentialsConfig = {
      clientId: "c",
      clientSecret: "s",
      tenantId: "t",
    };
    const requestFn = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ token_type: "Bearer" }),
    });

    // Act & Assert
    await expect(
      getAccessTokenFromClientCredentials(config, { requestFn }),
    ).rejects.toThrow("Token response missing access_token");
  });

  it("includes error_description in thrown message when present", async () => {
    // Setup
    const requestFn = vi.fn().mockResolvedValue({
      statusCode: 400,
      body: JSON.stringify({
        error: "invalid_request",
        error_description: "Missing grant_type",
      }),
    });

    // Act & Assert
    await expect(
      getAccessTokenFromClientCredentials(
        { clientId: "a", clientSecret: "b", tenantId: "c" },
        { requestFn },
      ),
    ).rejects.toThrow("Missing grant_type");
  });

  it("includes error in thrown message when error_description absent", async () => {
    // Setup
    const requestFn = vi.fn().mockResolvedValue({
      statusCode: 401,
      body: JSON.stringify({ error: "invalid_client" }),
    });

    // Act & Assert
    await expect(
      getAccessTokenFromClientCredentials(
        { clientId: "a", clientSecret: "b", tenantId: "c" },
        { requestFn },
      ),
    ).rejects.toThrow("invalid_client");
  });

  it("uses default request when requestFn not provided", async () => {
    // Setup: mock got so default path is taken
    const got = await import("got");
    vi.mocked(got.default.post).mockResolvedValue({
      body: JSON.stringify({ access_token: "default-token" }),
      statusCode: 200,
    } as never);

    // Act
    const result = await getAccessTokenFromClientCredentials({
      clientId: "c",
      clientSecret: "s",
      tenantId: "t",
    });

    // Assert
    expect(got.default.post).toHaveBeenCalled();
    expect(result).toBe("default-token");
  });

  it("throws with status only when error body is not JSON", async () => {
    // Setup
    const requestFn = vi.fn().mockResolvedValue({
      statusCode: 500,
      body: "Internal Server Error",
    });

    // Act & Assert
    await expect(
      getAccessTokenFromClientCredentials(
        { clientId: "a", clientSecret: "b", tenantId: "c" },
        { requestFn },
      ),
    ).rejects.toThrow("Token request failed: 500");
  });
});
