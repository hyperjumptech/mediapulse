export { createOutlookInboxClient } from "./create-outlook-inbox-client.js";
export type {
  CreateOutlookInboxClientOptions,
  ListMessagesOptions,
} from "./create-outlook-inbox-client.js";
export { getAccessTokenFromClientCredentials } from "./get-access-token.js";
export type {
  ClientCredentialsConfig,
  GetAccessTokenOptions,
} from "./get-access-token.js";
export { buildFilter } from "./build-filter.js";
export { createGraphClient } from "./graph-client.js";
export type {
  GraphClientOptions,
  GraphGetFn,
  GraphPostFn,
  GraphPatchFn,
  ListMessagesPaging,
  ListMessagesResult,
} from "./graph-client.js";
export type {
  GraphMessage,
  ListMessagesResponse,
  MessageFilter,
  OutlookInboxConfig,
  ProcessMessagesOptions,
} from "./types.js";
