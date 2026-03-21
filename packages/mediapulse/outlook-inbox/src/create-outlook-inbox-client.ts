import { createGraphClient } from "./graph-client.js";
import { getAccessTokenFromClientCredentials } from "./get-access-token.js";
import type {
  GraphMessage,
  MessageFilter,
  OutlookInboxConfig,
  ProcessMessagesOptions,
} from "./types.js";

const ARCHIVE_FOLDER = "archive";
const DELETED_ITEMS_FOLDER = "deleteditems";

/** Options for createOutlookInboxClient (DI). */
export type CreateOutlookInboxClientOptions = {
  /** Override Graph HTTP client (getFn, postFn); used for testing. */
  graphClientOptions?: Parameters<typeof createGraphClient>[1];
  /** Override token request function when using client credentials; used for testing. */
  getAccessTokenOptions?: Parameters<
    typeof getAccessTokenFromClientCredentials
  >[1];
};

/**
 * Creates an Outlook inbox client that lists messages with filters and archives or deletes them.
 * Use either config.getAccessToken (full control) or config.clientId + clientSecret + tenantId (client credentials).
 *
 * @param config - Token getter or client credentials; optional userId (default "me").
 * @param options - Optional graphClientOptions and getAccessTokenOptions for DI.
 * @returns Client with listMessages, processMessages, archiveMessage, deleteMessage.
 */
export function createOutlookInboxClient(
  config: OutlookInboxConfig,
  options: CreateOutlookInboxClientOptions = {},
) {
  const getAccessToken = resolveTokenGetter(config, options);
  const userId = config.userId ?? "me";
  const graph = createGraphClient(
    getAccessToken,
    options.graphClientOptions ?? {},
  );

  return {
    /**
     * Lists messages in the inbox matching the filter.
     *
     * @param filter - Subject, received date, unread criteria.
     * @param listOptions - Optional top (page size).
     * @returns Array of messages.
     */
    async listMessages(
      filter: MessageFilter,
      listOptions?: { top?: number },
    ): Promise<GraphMessage[]> {
      return graph.listMessages(userId, filter, {
        top: listOptions?.top,
        orderBy: "receivedDateTime desc",
      });
    },

    /**
     * Lists messages matching the filter, then archives or deletes them (default archive).
     *
     * @param filter - Same as listMessages.
     * @param processOptions - action 'archive' (default) or 'delete'; optional maxMessages.
     * @returns Array of messages that were processed.
     */
    async processMessages(
      filter: MessageFilter,
      processOptions: ProcessMessagesOptions = {},
    ): Promise<GraphMessage[]> {
      const action = processOptions.action ?? "archive";
      const maxMessages = processOptions.maxMessages;
      const messages = await graph.listMessages(userId, filter, {
        orderBy: "receivedDateTime desc",
        ...(maxMessages !== undefined && { top: maxMessages }),
      });
      const toProcess =
        maxMessages !== undefined ? messages.slice(0, maxMessages) : messages;
      const destinationId =
        action === "archive" ? ARCHIVE_FOLDER : DELETED_ITEMS_FOLDER;

      const processed: GraphMessage[] = [];
      for (const msg of toProcess) {
        await graph.moveMessage(userId, msg.id, destinationId);
        processed.push(msg);
      }
      return processed;
    },

    /**
     * Archives one or more messages (moves to Archive folder).
     *
     * @param messageIdOrIds - Single message ID or array of message IDs.
     * @returns Array of moved messages (one per ID).
     */
    async archiveMessage(
      messageIdOrIds: string | string[],
    ): Promise<GraphMessage[]> {
      const ids = Array.isArray(messageIdOrIds)
        ? messageIdOrIds
        : [messageIdOrIds];
      const results: GraphMessage[] = [];
      for (const id of ids) {
        const moved = await graph.moveMessage(userId, id, ARCHIVE_FOLDER);
        results.push(moved);
      }
      return results;
    },

    /**
     * Deletes one or more messages (moves to Deleted Items folder).
     *
     * @param messageIdOrIds - Single message ID or array of message IDs.
     * @returns Array of moved messages (one per ID).
     */
    async deleteMessage(
      messageIdOrIds: string | string[],
    ): Promise<GraphMessage[]> {
      const ids = Array.isArray(messageIdOrIds)
        ? messageIdOrIds
        : [messageIdOrIds];
      const results: GraphMessage[] = [];
      for (const id of ids) {
        const moved = await graph.moveMessage(userId, id, DELETED_ITEMS_FOLDER);
        results.push(moved);
      }
      return results;
    },
  };
}

/**
 * Resolves the token getter from config: either user-provided or client credentials.
 */
function resolveTokenGetter(
  config: OutlookInboxConfig,
  options: CreateOutlookInboxClientOptions,
): () => Promise<string> {
  if (typeof config.getAccessToken === "function") {
    return config.getAccessToken;
  }
  const { clientId, clientSecret, tenantId } = config;
  if (
    clientId === undefined ||
    clientSecret === undefined ||
    tenantId === undefined
  ) {
    throw new Error(
      "OutlookInboxConfig must provide getAccessToken or (clientId, clientSecret, tenantId)",
    );
  }
  return () =>
    getAccessTokenFromClientCredentials(
      { clientId, clientSecret, tenantId },
      options.getAccessTokenOptions ?? {},
    );
}
