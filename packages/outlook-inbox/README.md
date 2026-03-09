# @workspace/outlook-inbox

Connect to Microsoft Outlook inbox via Microsoft Graph API. List messages with filters (subject, date, unread) and archive or delete them.

## Install

In an app or package that consumes this library:

```bash
pnpm add @workspace/outlook-inbox
```

## Configuration

The package does **not** read `process.env` directly. Consuming apps should use `@workspace/env` (or their app env slice) and pass credentials into the client.

### Option 1: Client credentials (app-only)

Use Azure AD app registration with **Application** permission `Mail.ReadWrite` (or `Mail.Read` for list-only). Pass `clientId`, `clientSecret`, `tenantId`, and optionally `userId` (the mailbox to access; omit for delegated "me").

```ts
import { createOutlookInboxClient } from "@workspace/outlook-inbox";
import { env } from "@workspace/env";

const client = createOutlookInboxClient({
  clientId: env.OUTLOOK_CLIENT_ID,
  clientSecret: env.OUTLOOK_CLIENT_SECRET,
  tenantId: env.OUTLOOK_TENANT_ID,
  userId: env.OUTLOOK_USER_ID ?? "me",
});
```

### Option 2: Custom token (e.g. delegated)

Supply your own token getter:

```ts
const client = createOutlookInboxClient({
  getAccessToken: async () => {
    // Return a valid Graph access token (e.g. from MSAL, on-behalf-of, etc.)
    return myTokenProvider.getToken();
  },
  userId: "me",
});
```

### Environment variables (for consuming apps)

Document in your app’s `env.example` (and add to your env schema) for client-credentials usage:

- `OUTLOOK_CLIENT_ID` — Azure AD app (client) ID
- `OUTLOOK_CLIENT_SECRET` — Client secret (server-only, no `NEXT_PUBLIC_`)
- `OUTLOOK_TENANT_ID` — Azure AD tenant ID
- `OUTLOOK_USER_ID` — Optional; mailbox user ID for app-only, or omit for "me"

## Filtering messages

Use `MessageFilter` when listing or processing:

| Field             | Description                               |
| ----------------- | ----------------------------------------- |
| `subjectEquals`   | Subject must equal this string            |
| `subjectContains` | Subject must contain this substring       |
| `receivedAfter`   | Messages received on or after this date   |
| `receivedBefore`  | Messages received on or before this date  |
| `isUnread`        | `true` = only unread, `false` = only read |

Example:

```ts
const messages = await client.listMessages(
  {
    subjectContains: "Report",
    receivedAfter: new Date("2024-01-01"),
    isUnread: true,
  },
  { top: 50 },
);
```

## Archive vs delete

- **Archive (default):** Moves messages to the Outlook **Archive** folder (One-Click Archive).
- **Delete:** Moves messages to **Deleted Items** (recoverable).

```ts
// Archive matching messages (default)
await client.processMessages(
  { subjectEquals: "Processed" },
  { action: "archive" },
);

// Delete matching messages (move to Deleted Items)
await client.processMessages(
  { subjectContains: "Spam" },
  { action: "delete", maxMessages: 100 },
);

// Single message or array of IDs
await client.archiveMessage(messageId);
await client.archiveMessage([id1, id2, id3]);
await client.deleteMessage(messageId);
await client.deleteMessage([id1, id2]);
```

## API summary

- **`createOutlookInboxClient(config, options?)`** — Creates the client. Config: `getAccessToken` or (`clientId`, `clientSecret`, `tenantId`); optional `userId` (default `"me"`).
- **`client.listMessages(filter, options?)`** — Returns messages matching the filter. Options: `top` (page size).
- **`client.processMessages(filter, options?)`** — Lists matching messages, then moves them to archive or deleted items. Options: `action` (`"archive"` \| `"delete"`, default `"archive"`), `maxMessages`.
- **`client.archiveMessage(messageIdOrIds)`** — Moves one or more messages to Archive. Accepts a single ID or array of IDs; returns array of moved messages.
- **`client.deleteMessage(messageIdOrIds)`** — Moves one or more messages to Deleted Items. Accepts a single ID or array of IDs; returns array of moved messages.

## Types

- `OutlookInboxConfig`, `MessageFilter`, `ProcessMessagesOptions`, `GraphMessage` — see package exports or `src/types.ts`.
