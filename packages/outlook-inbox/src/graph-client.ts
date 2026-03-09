import got from "got";
import type {
  GraphMessage,
  ListMessagesResponse,
  MessageFilter,
} from "./types.js";
import { applySubjectFilter, buildFilterForGraph } from "./build-filter.js";

const DEFAULT_GRAPH_BASE = "https://graph.microsoft.com/v1.0";

/** HTTP GET function for DI. */
export type GraphGetFn = (
  url: string,
  options?: { headers?: Record<string, string> },
) => Promise<{ body: string; statusCode: number }>;

/** HTTP POST function for DI. */
export type GraphPostFn = (
  url: string,
  options?: { json?: unknown; headers?: Record<string, string> },
) => Promise<{ body: string; statusCode: number }>;

/** Options for the Graph client (DI). */
export type GraphClientOptions = {
  /** Base URL for Graph API (default https://graph.microsoft.com/v1.0). */
  baseUrl?: string;
  /** GET implementation; defaults to got.get. */
  getFn?: GraphGetFn;
  /** POST implementation; defaults to got.post. */
  postFn?: GraphPostFn;
};

/**
 * Creates a Graph API client for mailbox operations.
 * Uses the provided getAccessToken for Bearer auth on each request.
 *
 * @param getAccessToken - Returns a valid Graph access token.
 * @param options - Optional baseUrl, getFn, postFn for DI.
 * @returns Object with listMessages, moveMessage.
 */
export function createGraphClient(
  getAccessToken: () => Promise<string>,
  options: GraphClientOptions = {},
) {
  const baseUrl = options.baseUrl ?? DEFAULT_GRAPH_BASE;
  const getFn = options.getFn ?? defaultGet;
  const postFn = options.postFn ?? defaultPost;

  return {
    /**
     * Lists messages in the user's inbox matching the filter.
     *
     * @param userId - User ID or "me".
     * @param filter - Filter criteria (subject, received, isUnread).
     * @param paging - Optional top (max 1000) and orderBy.
     * @returns Array of messages.
     */
    async listMessages(
      userId: string,
      filter: MessageFilter,
      paging?: { top?: number; orderBy?: string },
    ): Promise<GraphMessage[]> {
      const token = await getAccessToken();
      const filterStr = buildFilterForGraph(filter);
      const url = new URL(
        `${baseUrl}/users/${encodeURIComponent(userId)}/messages`,
      );
      if (filterStr) url.searchParams.set("$filter", filterStr);
      if (paging?.top !== undefined)
        url.searchParams.set("$top", String(paging.top));
      if (paging?.orderBy) url.searchParams.set("$orderby", paging.orderBy);

      const res = await getFn(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(
          `Graph list messages failed: ${res.statusCode} - ${res.body}`,
        );
      }

      const data = JSON.parse(res.body) as ListMessagesResponse;
      const messages = data.value ?? [];
      return applySubjectFilter(messages, filter);
    },

    /**
     * Moves a message to another folder (e.g. archive, deleteditems).
     *
     * @param userId - User ID or "me".
     * @param messageId - Message ID.
     * @param destinationId - Well-known name or folder ID (e.g. "archive", "deleteditems").
     * @returns The moved message from the response.
     */
    async moveMessage(
      userId: string,
      messageId: string,
      destinationId: string,
    ): Promise<GraphMessage> {
      const token = await getAccessToken();
      const url = `${baseUrl}/users/${encodeURIComponent(userId)}/messages/${encodeURIComponent(messageId)}/move`;

      const res = await postFn(url, {
        json: { destinationId },
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw new Error(
          `Graph move message failed: ${res.statusCode} - ${res.body}`,
        );
      }

      return JSON.parse(res.body) as GraphMessage;
    },
  };
}

async function defaultGet(
  url: string,
  opts?: { headers?: Record<string, string> },
): Promise<{ body: string; statusCode: number }> {
  const res = await got.get(url, {
    headers: opts?.headers,
    throwHttpErrors: false,
  });
  const bodyStr =
    typeof res.body === "string" ? res.body : JSON.stringify(res.body);
  return { body: bodyStr, statusCode: res.statusCode ?? 0 };
}

async function defaultPost(
  url: string,
  opts?: { json?: unknown; headers?: Record<string, string> },
): Promise<{ body: string; statusCode: number }> {
  const res = await got.post(url, {
    json: opts?.json,
    headers: opts?.headers,
    throwHttpErrors: false,
  });
  const bodyStr =
    typeof res.body === "string" ? res.body : JSON.stringify(res.body);
  return { body: bodyStr, statusCode: res.statusCode ?? 0 };
}
