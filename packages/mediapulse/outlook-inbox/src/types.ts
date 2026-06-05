/**
 * Configuration for connecting to Microsoft Outlook via Graph API.
 * Provide either getAccessToken (full control) or client credentials (clientId, clientSecret, tenantId).
 */
export type OutlookInboxConfig = {
  /** Custom token getter; if set, client credentials are ignored. */
  getAccessToken?: () => Promise<string>;
  /** Azure AD app (client) ID. Required when not using getAccessToken. */
  clientId?: string;
  /** Azure AD client secret. Required when not using getAccessToken. */
  clientSecret?: string;
  /** Azure AD tenant ID. Required when not using getAccessToken. */
  tenantId?: string;
  /** User ID or "me" for delegated auth; for app-only, the mailbox to access. Default "me". */
  userId?: string;
  /**
   * Well-known folder name or folder id to list from (default "inbox"). Scoping
   * to a folder ensures archived messages leave the result set. Set to "" to
   * query the whole mailbox.
   */
  mailFolder?: string;
};

/**
 * Filter criteria for listing inbox messages.
 * All fields are optional; combined with AND logic.
 */
export type MessageFilter = {
  /** Subject must equal this string (case-sensitive). */
  subjectEquals?: string;
  /** Subject must contain this substring (case-insensitive in Graph contains). */
  subjectContains?: string;
  /** Messages received on or after this date. */
  receivedAfter?: Date;
  /** Messages received on or before this date. */
  receivedBefore?: Date;
  /** When true, only unread messages; when false, only read. Omit for both. */
  isUnread?: boolean;
};

/**
 * Options for processMessages (archive or delete matched messages).
 */
export type ProcessMessagesOptions = {
  /** 'archive' moves to Archive folder (default); 'delete' moves to Deleted Items. */
  action?: "archive" | "delete";
  /** Maximum number of messages to process; omit for no limit. */
  maxMessages?: number;
};

export type { GraphMessage, ListMessagesResponse } from "./schemas.js";
