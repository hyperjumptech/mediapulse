import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentDataApiClient } from "./index.js";

vi.mock("got", () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

const getGot = async () => (await import("got")).default;

describe("AgentDataApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("performs a GET with query params and apiKey", async () => {
    // Setup
    const got = await getGot();
    (got.get as any).mockResolvedValue({
      body: JSON.stringify({ ok: true }),
      headers: { "content-type": "application/json" },
    });
    const client = new AgentDataApiClient({
      url: "http://agent-data-api/api/example",
    });

    // Act
    const result = await client.get<{ ok: boolean }>({
      query: { tickerId: "123" },
      apiKey: "Bearer test",
    });

    // Assert
    expect(got.get).toHaveBeenCalledWith(
      "http://agent-data-api/api/example?tickerId=123",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test",
        }),
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("performs a POST with JSON body and apiKey", async () => {
    // Setup
    const got = await getGot();
    (got.post as any).mockResolvedValue({
      body: "",
      headers: { "content-type": "application/json" },
    });
    const client = new AgentDataApiClient({
      url: "http://agent-data-api/api/example",
    });

    // Act
    await client.post({
      body: { foo: "bar" },
      apiKey: "Bearer test",
    });

    // Assert
    expect(got.post).toHaveBeenCalledWith(
      "http://agent-data-api/api/example",
      expect.objectContaining({
        json: { foo: "bar" },
        headers: expect.objectContaining({
          Authorization: "Bearer test",
        }),
      }),
    );
  });

  it("parses JSON response for non-void POST", async () => {
    // Setup
    const got = await getGot();
    (got.post as any).mockResolvedValue({
      body: JSON.stringify({ id: "123" }),
      headers: { "content-type": "application/json" },
    });
    const client = new AgentDataApiClient({
      url: "http://agent-data-api/api/example",
    });

    // Act
    const result = await client.post<{ foo: string }, { id: string }>({
      body: { foo: "bar" },
    });

    // Assert
    expect(result).toEqual({ id: "123" });
  });
});
