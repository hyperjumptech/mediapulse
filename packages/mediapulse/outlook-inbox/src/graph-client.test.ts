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
    it("calls GET with Graph-safe filter and applies subject filter client-side", async () => {
      // Setup: subject filters are not sent to Graph (avoids InefficientFilter), applied in memory
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
      const result = await client.listMessages("me", filter, { pageSize: 50 });

      // Assert: URL has only Graph-safe OData filter (no subject); subject applied client-side
      expect(getAccessToken).toHaveBeenCalledTimes(1);
      expect(getFn).toHaveBeenCalledTimes(1);
      expect(getFn.mock.calls[0]).toBeDefined();
      const [url, opts] = getFn.mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(url).toContain("/users/me/messages");
      expect(url).toContain("isRead");
      expect(url).toContain("false");
      expect(url).not.toContain("contains(subject"); // subject filter applied client-side
      expect(url).not.toContain("search="); // $search omitted when $filter applies
      expect(url).toContain("top=50");
      expect(opts.headers.Authorization).toBe("Bearer bearer-token");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]!.id).toBe("msg-1");
      expect(result.messages[0]!.subject).toBe("Test");
      expect(result.drained).toBe(true);
      expect(result.pagesScanned).toBe(1);
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

    it("returns empty messages and drained: true when value is missing in response", async () => {
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
      expect(result.messages).toEqual([]);
      expect(result.drained).toBe(true);
    });

    it("throws when list response has invalid value shape", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ value: "not-an-array" }),
      });
      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });

      // Act & Assert
      await expect(client.listMessages("me", {})).rejects.toThrow();
    });

    it("follows @odata.nextLink across multiple pages and collects all matching messages", async () => {
      // Setup: 3 pages, subscription messages interleaved with non-matching subjects.
      // Page 1 alone has fewer matches than limit — the scenario the production bug dropped.
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const PAGE1_NEXT =
        "https://graph.microsoft.com/v1.0/users/me/messages?$skiptoken=page2";
      const PAGE2_NEXT =
        "https://graph.microsoft.com/v1.0/users/me/messages?$skiptoken=page3";

      const makeMsg = (id: string, subject: string, day: string) => ({
        id,
        subject,
        receivedDateTime: `2024-01-${day}T00:00:00Z`,
        isRead: false,
      });

      const getFn = vi
        .fn()
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify({
            value: [
              makeMsg(
                "01",
                "[MediaPulse] Newsletter Subscription - AAPL",
                "01",
              ),
              makeMsg("02", "Unrelated email", "02"),
              makeMsg(
                "03",
                "[MediaPulse] Newsletter Subscription - BBCA",
                "03",
              ),
            ],
            "@odata.nextLink": PAGE1_NEXT,
          }),
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify({
            value: [
              makeMsg("04", "Another unrelated", "04"),
              makeMsg(
                "05",
                "[MediaPulse] Newsletter Subscription - TSLA",
                "05",
              ),
              makeMsg(
                "06",
                "[MediaPulse] Newsletter Subscription - MSFT",
                "06",
              ),
            ],
            "@odata.nextLink": PAGE2_NEXT,
          }),
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify({
            value: [
              makeMsg(
                "07",
                "[MediaPulse] Newsletter Subscription - GOOG",
                "07",
              ),
              makeMsg("08", "Spam", "08"),
            ],
          }),
        });

      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });
      const filter: MessageFilter = {
        subjectContains: "[MediaPulse] Newsletter Subscription",
        isUnread: true,
      };

      // Act
      const result = await client.listMessages("me", filter, {
        pageSize: 3,
        limit: 10,
        maxPages: 5,
      });

      // Assert: all 5 matching messages collected across 3 pages
      expect(result.messages).toHaveLength(5);
      expect(result.messages.map((m) => m.id)).toEqual([
        "01",
        "03",
        "05",
        "06",
        "07",
      ]);
      expect(result.pagesScanned).toBe(3);
      expect(result.messagesScanned).toBe(8);
      expect(result.drained).toBe(true);

      // Each subsequent page used the nextLink URL verbatim
      expect(getFn).toHaveBeenCalledTimes(3);
      expect((getFn.mock.calls[1] as [string])[0]).toBe(PAGE1_NEXT);
      expect((getFn.mock.calls[2] as [string])[0]).toBe(PAGE2_NEXT);
    });

    it("stops at maxPages and returns drained: false", async () => {
      // Setup: infinite pages (every response has a nextLink)
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const NEXT =
        "https://graph.microsoft.com/v1.0/users/me/messages?$skiptoken=next";

      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "m1",
              subject: "Test",
              receivedDateTime: "2024-01-01T00:00:00Z",
              isRead: false,
            },
          ],
          "@odata.nextLink": NEXT,
        }),
      });

      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });

      // Act
      const result = await client.listMessages(
        "me",
        { subjectContains: "Test", isUnread: true },
        { pageSize: 10, limit: 100, maxPages: 2 },
      );

      // Assert: stopped at maxPages
      expect(result.pagesScanned).toBe(2);
      expect(result.drained).toBe(false);
      expect(getFn).toHaveBeenCalledTimes(2);
    });

    it("returns drained: true when all pages are exhausted before limit", async () => {
      // Setup: only 2 matches, limit is 10
      const getAccessToken = vi.fn().mockResolvedValue("t");

      const getFn = vi.fn().mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "m1",
              subject: "Test",
              receivedDateTime: "2024-01-01T00:00:00Z",
              isRead: false,
            },
            {
              id: "m2",
              subject: "Test",
              receivedDateTime: "2024-01-02T00:00:00Z",
              isRead: false,
            },
          ],
        }),
      });

      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });

      // Act
      const result = await client.listMessages(
        "me",
        { subjectContains: "Test", isUnread: true },
        { limit: 10 },
      );

      // Assert: all matches collected, no nextLink — fully drained
      expect(result.messages).toHaveLength(2);
      expect(result.drained).toBe(true);
      expect(getFn).toHaveBeenCalledTimes(1);
    });

    it("returns drained: false when limit is hit before pages run out", async () => {
      // Setup: 3 messages on one page, limit 2 — last message on page is skipped
      const getAccessToken = vi.fn().mockResolvedValue("t");

      const getFn = vi.fn().mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "m1",
              subject: "Test",
              receivedDateTime: "2024-01-01T00:00:00Z",
              isRead: false,
            },
            {
              id: "m2",
              subject: "Test",
              receivedDateTime: "2024-01-02T00:00:00Z",
              isRead: false,
            },
            {
              id: "m3",
              subject: "Test",
              receivedDateTime: "2024-01-03T00:00:00Z",
              isRead: false,
            },
          ],
        }),
      });

      const client = createGraphClient(getAccessToken, {
        getFn,
        postFn: vi.fn(),
      });

      // Act
      const result = await client.listMessages(
        "me",
        { subjectContains: "Test", isUnread: true },
        { limit: 2 },
      );

      // Assert: limit hit; m3 was on the same page but not collected
      expect(result.messages).toHaveLength(2);
      expect(result.drained).toBe(false);
    });

    it("omits $search when a $filter applies, avoiding the SearchWithFilter 400", async () => {
      // Setup: subjectContains combined with isUnread/receivedAfter. Graph rejects
      // $search + $filter (SearchWithFilter), so $filter wins and subject is applied
      // client-side; $orderby is then allowed server-side alongside $filter.
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
      await client.listMessages(
        "me",
        {
          subjectContains: "Newsletter",
          isUnread: true,
          receivedAfter: new Date("2024-01-01T00:00:00Z"),
        },
        { orderBy: "receivedDateTime asc" },
      );

      // Assert
      expect(getFn).toHaveBeenCalledTimes(1);
      const [url, opts] = getFn.mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(url).not.toContain("search="); // $search dropped to avoid SearchWithFilter
      expect(url).not.toContain("contains(subject"); // subject applied client-side
      expect(url).toContain("isRead"); // $filter has isRead
      expect(url).toContain("receivedDateTime"); // $filter has receivedDateTime bound
      expect(url).toContain("orderby"); // $orderby allowed alongside $filter
      expect(opts.headers["ConsistencyLevel"]).toBeUndefined();
      expect(opts.headers.Authorization).toBe("Bearer t");
    });

    it("uses $search and ConsistencyLevel header when subjectContains is the only criterion", async () => {
      // Setup: no $filter criteria, so $search subject scoping is safe to use
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
      await client.listMessages(
        "me",
        { subjectContains: "Newsletter" },
        { orderBy: "receivedDateTime asc" },
      );

      // Assert
      expect(getFn).toHaveBeenCalledTimes(1);
      const [url, opts] = getFn.mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(url).toContain("search="); // $search present
      expect(url).toContain("Newsletter"); // scoped to subject
      expect(url).not.toContain("orderby"); // $orderby absent with $search (sorted client-side)
      expect(opts.headers["ConsistencyLevel"]).toBe("eventual");
      expect(opts.headers.Authorization).toBe("Bearer t");
    });

    it("uses $orderby and no $search when subjectContains is not set", async () => {
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
      await client.listMessages(
        "me",
        { isUnread: true },
        { orderBy: "receivedDateTime desc" },
      );

      // Assert
      const [url] = getFn.mock.calls[0] as [string];
      expect(url).toContain("orderby");
      expect(url).not.toContain("search=");
    });

    it("sorts client-side by orderBy when $search is active", async () => {
      // Setup: two messages returned in reverse order; expect sorted oldest-first
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "newer",
              subject: "Test",
              receivedDateTime: "2024-01-02T00:00:00Z",
              isRead: false,
            },
            {
              id: "older",
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

      // Act
      const result = await client.listMessages(
        "me",
        { subjectContains: "Test" },
        { orderBy: "receivedDateTime asc" },
      );

      // Assert: sorted ascending — older first
      expect(result.messages[0]!.id).toBe("older");
      expect(result.messages[1]!.id).toBe("newer");
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

    it("throws when move response has invalid message shape", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ id: 123, subject: "x" }),
      });
      const client = createGraphClient(getAccessToken, {
        getFn: vi.fn(),
        postFn,
      });

      // Act & Assert
      await expect(
        client.moveMessage("me", "msg-1", "archive"),
      ).rejects.toThrow();
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
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.id).toBe("m1");
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
