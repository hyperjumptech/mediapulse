import got from "got";
import type { MessageFilter } from "./types.js";
import {
  type GraphMessage,
  graphMessageSchema,
  listMessagesResponseSchema,
} from "./schemas.js";
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

/** Pagination options for listMessages. */
export type ListMessagesPaging = {
  /** Per-page Graph $top (default 50, clamped 1–1000). */
  pageSize?: number;
  /** Max subject-matching messages to collect. Default: no limit. */
  limit?: number;
  /** OData $orderby; skipped when $search is active (client-side sort used instead). */
  orderBy?: string;
  /** Runaway-pagination backstop (default 20). */
  maxPages?: number;
};

/** Result returned by listMessages including pagination metadata. */
export type ListMessagesResult = {
  messages: GraphMessage[];
  /** Number of Graph pages fetched. */
  pagesScanned: number;
  /** Total messages seen across all pages (before subject filtering). */
  messagesScanned: number;
  /**
   * True when all pages were consumed and the limit was not hit —
   * the full matching set was collected. False when stopped early
   * at limit or maxPages (more matching mail may remain).
   */
  drained: boolean;
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
     * Lists messages in the user's inbox matching the filter, following
     * @odata.nextLink pagination until the limit, maxPages, or inbox end is reached.
     * When filter.subjectContains is set, adds $search subject scoping so fewer
     * pages are scanned; $orderby is then applied client-side after collection.
     *
     * @param userId - User ID or "me".
     * @param filter - Filter criteria (subject, received, isUnread).
     * @param paging - Optional pageSize, limit, orderBy, maxPages.
     * @returns Matched messages plus scan metadata.
     */
    async listMessages(
      userId: string,
      filter: MessageFilter,
      paging?: ListMessagesPaging,
    ): Promise<ListMessagesResult> {
      const token = await getAccessToken();
      const filterStr = buildFilterForGraph(filter);
      const pageSize = Math.min(Math.max(paging?.pageSize ?? 50, 1), 1000);
      const limit = paging?.limit;
      const maxPages = paging?.maxPages ?? 20;
      const useSearch =
        filter.subjectContains !== undefined && filter.subjectContains !== "";

      const initialUrl = new URL(
        `${baseUrl}/users/${encodeURIComponent(userId)}/messages`,
      );
      if (filterStr) initialUrl.searchParams.set("$filter", filterStr);
      initialUrl.searchParams.set("$top", String(pageSize));
      if (useSearch) {
        // Graph rejects $search + $orderby on messages; sort client-side instead.
        initialUrl.searchParams.set(
          "$search",
          `"subject:${filter.subjectContains}"`,
        );
      } else if (paging?.orderBy) {
        initialUrl.searchParams.set("$orderby", paging.orderBy);
      }

      const accumulatedMessages: GraphMessage[] = [];
      let pagesScanned = 0;
      let messagesScanned = 0;
      let limitReached = false;
      let nextUrl: string | undefined = initialUrl.toString();

      while (
        nextUrl !== undefined &&
        !limitReached &&
        pagesScanned < maxPages
      ) {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };
        if (useSearch) headers["ConsistencyLevel"] = "eventual";

        const res = await getFn(nextUrl, { headers });

        if (res.statusCode < 200 || res.statusCode >= 300) {
          throw new Error(
            `Graph list messages failed: ${res.statusCode} - ${res.body}`,
          );
        }

        const parsed = JSON.parse(res.body) as unknown;
        const data = listMessagesResponseSchema.parse(parsed);
        const pageMessages = data.value ?? [];

        pagesScanned++;
        messagesScanned += pageMessages.length;

        const matching = applySubjectFilter(pageMessages, filter);
        for (const msg of matching) {
          if (limit !== undefined && accumulatedMessages.length >= limit) {
            limitReached = true;
            break;
          }
          accumulatedMessages.push(msg);
        }

        nextUrl = data["@odata.nextLink"];
      }

      // When $search is active, $orderby cannot be used server-side; sort here instead.
      if (useSearch && paging?.orderBy) {
        const descending = paging.orderBy.toLowerCase().includes("desc");
        accumulatedMessages.sort((a, b) => {
          const timeA = new Date(a.receivedDateTime).getTime();
          const timeB = new Date(b.receivedDateTime).getTime();

          return descending ? timeB - timeA : timeA - timeB;
        });
      }

      const drained = nextUrl === undefined && !limitReached;

      return {
        messages: accumulatedMessages,
        pagesScanned,
        messagesScanned,
        drained,
      };
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

      const parsed = JSON.parse(res.body) as unknown;
      return graphMessageSchema.parse(parsed);
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
