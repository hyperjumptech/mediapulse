import { afterEach, describe, expect, it, vi } from "vitest";

import { createGraphClient } from "./graph-client.js";
import type { MessageFilter } from "./types.js";

vi.mock("got", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

describe("createGraphClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listMessages", () => {
    it("calls GET with filter and returns value array", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("bearer-token");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "msg-1",
              subject: "Test",
              receivedDateTime: "2024-01-01T00:00:00Z",
              isRead: false,
            },
          ],
        }),
      });
      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });
      const filter: MessageFilter = { subjectContains: "Test", isUnread: true };

      // Act
      const result = await client.listMessages("me", filter, { top: 50 });

      // Assert
      expect(getAccessToken).toHaveBeenCalledTimes(1);
      expect(getFn).toHaveBeenCalledTimes(1);
      expect(getFn.mock.calls[0]).toBeDefined();
      const [url, opts] = getFn.mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(url).toContain("/users/me/messages");
      expect(url).toContain("filter=");
      expect(url).toContain("contains");
      expect(url).toContain("subject");
      expect(url).toContain("Test");
      expect(url).toContain("isRead");
      expect(url).toContain("false");
      expect(url).toContain("top=50");
      expect(opts.headers.Authorization).toBe("Bearer bearer-token");
      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
      expect((result[0] as { id: string; subject: string }).id).toBe("msg-1");
      expect((result[0] as { id: string; subject: string }).subject).toBe(
        "Test",
      );
    });

    it("encodes userId in URL", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ value: [] }),
      });
      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });

      // Act
      await client.listMessages("user@domain.com", {});

      // Assert
      expect(getFn.mock.calls[0]).toBeDefined();
      expect((getFn.mock.calls[0] as [string])[0]).toContain(
        "/users/user%40domain.com/messages",
      );
    });

    it("throws when list returns non-2xx", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 403,
        body: "Forbidden",
      });
      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });

      // Act & Assert
      await expect(client.listMessages("me", {})).rejects.toThrow(
        "Graph list messages failed: 403",
      );
    });

    it("returns empty array when value is missing in response", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({}),
      });
      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });

      // Act
      const result = await client.listMessages("me", {});

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("moveMessage", () => {
    it("calls POST move with destinationId and returns moved message", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("token");
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          id: "msg-1",
          subject: "Moved",
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: true,
        }),
      });
      const client = createGraphClient(getAccessToken, {
        getFn: vi.fn(),
        postFn,
      });

      // Act
      const result = await client.moveMessage("me", "msg-1", "archive");

      // Assert
      expect(getAccessToken).toHaveBeenCalledTimes(1);
      expect(postFn).toHaveBeenCalledTimes(1);
      const [url, opts] = postFn.mock.calls[0] as [
        string,
        { json: { destinationId: string }; headers: Record<string, string> },
      ];
      expect(url).toContain("/users/me/messages/msg-1/move");
      expect(opts.json).toEqual({ destinationId: "archive" });
      expect(opts.headers.Authorization).toBe("Bearer token");
      expect(result.id).toBe("msg-1");
      expect(result.subject).toBe("Moved");
    });

    it("throws when move returns non-2xx", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 404,
        body: "Not found",
      });
      const client = createGraphClient(getAccessToken, {
        getFn: vi.fn(),
        postFn,
      });

      // Act & Assert
      await expect(
        client.moveMessage("me", "bad-id", "archive"),
      ).rejects.toThrow("Graph move message failed: 404");
    });
  });

  it("uses custom baseUrl when provided", async () => {
    // Setup
    const getAccessToken = vi.fn().mockResolvedValue("t");
    const getFn = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ value: [] }),
    });
    const client = createGraphClient(getAccessToken, {
      baseUrl: "https://graph.example.com/v1.0",
      getFn,
      postFn: vi.fn(),
    });

    // Act
    await client.listMessages("me", {});

    // Assert
    expect(getFn.mock.calls[0]).toBeDefined();
    expect((getFn.mock.calls[0] as [string])[0]).toMatch(
      /^https:\/\/graph\.example\.com\/v1\.0\/users\/me\/messages/,
    );
  });

  it("uses default get when getFn not provided", async () => {
    // Setup
    const got = await import("got");
    vi.mocked(got.default.get).mockResolvedValue({
      body: JSON.stringify({
        value: [
          {
            id: "m1",
            subject: "S",
            receivedDateTime: "2024-01-01T00:00:00Z",
            isRead: false,
          },
        ],
      }),
      statusCode: 200,
    } as never);
    const getAccessToken = vi.fn().mockResolvedValue("t");
    const client = createGraphClient(getAccessToken, { postFn: vi.fn() });

    // Act
    const result = await client.listMessages("me", {});

    // Assert
    expect(got.default.get).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();
    expect((result[0] as { id: string }).id).toBe("m1");
  });

  it("uses default post when postFn not provided", async () => {
    // Setup
    const got = await import("got");
    vi.mocked(got.default.post).mockResolvedValue({
      body: JSON.stringify({
        id: "m1",
        subject: "Moved",
        receivedDateTime: "2024-01-01T00:00:00Z",
        isRead: true,
      }),
      statusCode: 200,
    } as never);
    const getAccessToken = vi.fn().mockResolvedValue("t");
    const client = createGraphClient(getAccessToken, { getFn: vi.fn() });

    // Act
    const result = await client.moveMessage("me", "m1", "archive");

    // Assert
    expect(got.default.post).toHaveBeenCalled();
    expect(result.id).toBe("m1");
  });
});
