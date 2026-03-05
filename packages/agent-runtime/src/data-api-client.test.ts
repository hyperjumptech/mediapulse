import { afterEach, describe, expect, it, vi } from "vitest";

import { dataApiGet, dataApiPost } from "./data-api-client.js";

describe("dataApiGet", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds URL with path and query, sends Authorization, returns parsed JSON", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ data: "value" }),
      statusCode: 200,
    });
    const token = "Bearer secret";

    // Act
    const result = await dataApiGet<{ data: string }>(
      token,
      "http://api.example.com",
      "/api/delivery",
      { tickerId: "t-1" },
      { getFn },
    );

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      "http://api.example.com/api/delivery?tickerId=t-1",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret" },
      }),
    );
    expect(result).toEqual({ data: "value" });
  });

  it("omits Authorization header when token is undefined", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ ok: true }),
      statusCode: 200,
    });

    // Act
    await dataApiGet(
      undefined,
      "http://api.example.com",
      "/api/foo",
      undefined,
      {
        getFn,
      },
    );

    // Assert
    expect(getFn).toHaveBeenCalledWith(
      "http://api.example.com/api/foo",
      expect.objectContaining({ headers: undefined }),
    );
  });

  it("throws when response status is not 2xx", async () => {
    // Setup
    const getFn = vi.fn().mockResolvedValue({ body: "error", statusCode: 404 });

    // Act / Assert
    await expect(
      dataApiGet("Bearer x", "http://api.example.com", "/api/foo", undefined, {
        getFn,
      }),
    ).rejects.toThrow("Agent data API error: 404");
  });
});

describe("dataApiPost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs JSON body with Authorization and returns body string", async () => {
    // Setup
    const postFn = vi.fn().mockResolvedValue({
      body: JSON.stringify({ id: "1" }),
      statusCode: 200,
    });
    const token = "Bearer secret";

    // Act
    const result = await dataApiPost(
      token,
      "http://api.example.com",
      "/api/delivery",
      { userTickerId: "t-1" },
      { postFn },
    );

    // Assert
    expect(postFn).toHaveBeenCalledWith(
      "http://api.example.com/api/delivery",
      expect.objectContaining({
        json: { userTickerId: "t-1" },
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret",
        },
      }),
    );
    expect(result).toBe('{"id":"1"}');
  });

  it("throws when response status is not 2xx", async () => {
    // Setup
    const postFn = vi
      .fn()
      .mockResolvedValue({ body: "error", statusCode: 500 });

    // Act / Assert
    await expect(
      dataApiPost(
        "Bearer x",
        "http://api.example.com",
        "/api/foo",
        {},
        { postFn },
      ),
    ).rejects.toThrow("Agent data API error: 500");
  });
});
