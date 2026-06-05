import { afterEach, describe, expect, it, vi } from "vitest";

import { createOutlookInboxClient } from "./create-outlook-inbox-client.js";
import type { MessageFilter } from "./types.js";

describe("createOutlookInboxClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when neither getAccessToken nor client credentials are provided", () => {
    // Act & Assert
    expect(() => createOutlookInboxClient({})).toThrow(
      "getAccessToken or (clientId, clientSecret, tenantId)",
    );
  });

  it("throws when only partial client credentials are provided", () => {
    // Act & Assert
    expect(() =>
      createOutlookInboxClient({ clientId: "a", tenantId: "c" }),
    ).toThrow("getAccessToken or (clientId, clientSecret, tenantId)");
  });

  it("uses client credentials when getAccessToken not provided", async () => {
    // Setup: inject token request and graph HTTP so no real calls
    const requestFn = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ access_token: "client-cred-token" }),
    });
    const getFn = vi.fn().mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ value: [] }),
    });
    const client = createOutlookInboxClient(
      {
        clientId: "cid",
        clientSecret: "csecret",
        tenantId: "tid",
      },
      {
        getAccessTokenOptions: { requestFn },
        graphClientOptions: { getFn, postFn: vi.fn() },
      },
    );

    // Act
    await client.listMessages({});

    // Assert
    expect(requestFn).toHaveBeenCalled();
    expect(getFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer client-cred-token" },
      }),
    );
  });

  describe("with getAccessToken", () => {
    it("listMessages uses userId me by default and calls graph listMessages", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("token");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "m1",
              subject: "Hi",
              receivedDateTime: "2024-01-01T00:00:00Z",
              isRead: false,
            },
          ],
        }),
      });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn, postFn: vi.fn() } },
      );
      const filter: MessageFilter = { subjectContains: "Hi" };

      // Act
      const result = await client.listMessages(filter);

      // Assert
      expect(getFn.mock.calls[0]).toBeDefined();
      expect((getFn.mock.calls[0] as [string])[0]).toContain(
        "/users/me/messages",
      );
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toBeDefined();
      expect(result.messages[0]!.id).toBe("m1");
    });

    it("listMessages uses custom userId when provided", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({ value: [] }),
      });
      const client = createOutlookInboxClient(
        { getAccessToken, userId: "user-123" },
        { graphClientOptions: { getFn, postFn: vi.fn() } },
      );

      // Act
      await client.listMessages({});

      // Assert
      expect(getFn.mock.calls[0]).toBeDefined();
      expect((getFn.mock.calls[0] as [string])[0]).toContain(
        "/users/user-123/messages",
      );
    });

    it("processMessages defaults to archive and moves to archive folder", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "msg-1",
              subject: "X",
              receivedDateTime: "2024-01-01T00:00:00Z",
              isRead: false,
            },
          ],
        }),
      });
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          id: "msg-1",
          subject: "X",
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
        }),
      });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn, postFn } },
      );

      // Act
      const processed = await client.processMessages({ subjectContains: "X" });

      // Assert
      expect(processed).toHaveLength(1);
      expect(processed[0]).toBeDefined();
      expect((processed[0] as { id: string }).id).toBe("msg-1");
      expect(postFn).toHaveBeenCalledTimes(1);
      const moveCall = postFn.mock.calls[0] as [
        string,
        { json: { destinationId: string } },
      ];
      expect(moveCall[1].json.destinationId).toBe("archive");
    });

    it("processMessages with action delete moves to deleteditems", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "msg-2",
              subject: "Y",
              receivedDateTime: "2024-01-02T00:00:00Z",
              isRead: true,
            },
          ],
        }),
      });
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          id: "msg-2",
          subject: "Y",
          receivedDateTime: "2024-01-02T00:00:00Z",
          isRead: true,
        }),
      });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn, postFn } },
      );

      // Act
      await client.processMessages(
        { subjectEquals: "Y" },
        { action: "delete" },
      );

      // Assert
      expect(postFn).toHaveBeenCalledWith(
        expect.stringContaining("/messages/msg-2/move"),
        expect.objectContaining({ json: { destinationId: "deleteditems" } }),
      );
    });

    it("processMessages respects maxMessages", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const getFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          value: [
            {
              id: "1",
              subject: "A",
              receivedDateTime: "2024-01-01T00:00:00Z",
              isRead: false,
            },
            {
              id: "2",
              subject: "B",
              receivedDateTime: "2024-01-02T00:00:00Z",
              isRead: false,
            },
            {
              id: "3",
              subject: "C",
              receivedDateTime: "2024-01-03T00:00:00Z",
              isRead: false,
            },
          ],
        }),
      });
      const postFn = vi
        .fn()
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify({
            id: "1",
            subject: "A",
            receivedDateTime: "2024-01-01T00:00:00Z",
            isRead: false,
          }),
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify({
            id: "2",
            subject: "B",
            receivedDateTime: "2024-01-02T00:00:00Z",
            isRead: false,
          }),
        });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn, postFn } },
      );

      // Act
      const processed = await client.processMessages(
        {},
        { action: "archive", maxMessages: 2 },
      );

      // Assert
      expect(processed).toHaveLength(2);
      expect(postFn).toHaveBeenCalledTimes(2);
    });

    it("archiveMessage moves single message to archive", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          id: "single",
          subject: "Archived",
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: true,
        }),
      });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn: vi.fn(), postFn } },
      );

      // Act
      const result = await client.archiveMessage("single");

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
      expect((result[0] as { id: string }).id).toBe("single");
      expect(postFn).toHaveBeenCalledWith(
        expect.stringContaining("/messages/single/move"),
        expect.objectContaining({ json: { destinationId: "archive" } }),
      );
    });

    it("archiveMessage accepts array of ids and moves each to archive", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const postFn = vi
        .fn()
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify({
            id: "a1",
            subject: "A",
            receivedDateTime: "2024-01-01T00:00:00Z",
            isRead: false,
          }),
        })
        .mockResolvedValueOnce({
          statusCode: 200,
          body: JSON.stringify({
            id: "a2",
            subject: "B",
            receivedDateTime: "2024-01-02T00:00:00Z",
            isRead: false,
          }),
        });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn: vi.fn(), postFn } },
      );

      // Act
      const result = await client.archiveMessage(["a1", "a2"]);

      // Assert
      expect(result).toHaveLength(2);
      expect((result[0] as { id: string }).id).toBe("a1");
      expect((result[1] as { id: string }).id).toBe("a2");
      expect(postFn).toHaveBeenCalledTimes(2);
      expect(postFn).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/messages/a1/move"),
        expect.objectContaining({ json: { destinationId: "archive" } }),
      );
      expect(postFn).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/messages/a2/move"),
        expect.objectContaining({ json: { destinationId: "archive" } }),
      );
    });

    it("deleteMessage moves single message to deleteditems", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          id: "del-1",
          subject: null,
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
        }),
      });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn: vi.fn(), postFn } },
      );

      // Act
      const result = await client.deleteMessage("del-1");

      // Assert
      expect(result).toHaveLength(1);
      expect((result[0] as { id: string }).id).toBe("del-1");
      expect(postFn).toHaveBeenCalledWith(
        expect.stringContaining("/messages/del-1/move"),
        expect.objectContaining({ json: { destinationId: "deleteditems" } }),
      );
    });

    it("deleteMessage accepts array of ids and moves each to deleteditems", async () => {
      // Setup
      const getAccessToken = vi.fn().mockResolvedValue("t");
      const postFn = vi.fn().mockResolvedValue({
        statusCode: 200,
        body: JSON.stringify({
          id: "x",
          subject: null,
          receivedDateTime: "2024-01-01T00:00:00Z",
          isRead: false,
        }),
      });
      const client = createOutlookInboxClient(
        { getAccessToken },
        { graphClientOptions: { getFn: vi.fn(), postFn } },
      );

      // Act
      const result = await client.deleteMessage(["d1", "d2", "d3"]);

      // Assert
      expect(result).toHaveLength(3);
      expect(postFn).toHaveBeenCalledTimes(3);
      expect(postFn).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/messages/d1/move"),
        expect.objectContaining({ json: { destinationId: "deleteditems" } }),
      );
      expect(postFn).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("/messages/d3/move"),
        expect.objectContaining({ json: { destinationId: "deleteditems" } }),
      );
    });
  });
});
