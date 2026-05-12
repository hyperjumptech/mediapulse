# user-registration agent

A Hermes agent that polls an Outlook inbox for newsletter subscription emails, processes registrations against the database via `agent-data-api`, sends confirmation notification emails via Resend, and confirms subscriptions through `agent-data-api`.

## What it does

1. Lists unread messages from the configured Outlook mailbox.
2. Parses the **subscriber email** from the message `From` address (the address that actually sent the mail), the **ticker** from the subject (and body fallbacks), and the **display name** from the message body (`Name:` line from the registration mailto, or legacy `Subscriber Name:`), then Microsoft Graph `from.emailAddress.name` when usable, then a title-cased guess from the email local part.
3. Calls `agent-data-api POST /api/v1/user-registration-register` to create or update the `UserTicker` row.
4. When the subscription is new or unconfirmed, sends a plain-text confirmation notification email (Resend) and immediately confirms the subscription via `agent-data-api` (no user action required).
5. Archives the processed message out of the inbox (best-effort) to keep the mailbox clear.

## Archiving and retries

- **Archive on success**: After a message is processed (including invalid/unparseable cases), the agent archives it so it does not remain in the primary inbox.
- **Confirm is best-effort**: If `user-registration-confirm` fails after a successful registration, the agent still archives the message to avoid repeated inbox clutter.
- **Register retry (bounded)**: The agent retries the register call once on transient failures (e.g. 429/5xx or network errors). If registration cannot be completed after the retry, the message is left unarchived so it can be retried on the next run.

## Environment variables

| Variable             | Required | Description                   |
| -------------------- | -------- | ----------------------------- |
| `PORT`               | No       | HTTP port (default `3000`)    |
| `AGENT_DATA_API_URL` | Yes      | Base URL for `agent-data-api` |

## Hermes config fields

These are supplied by the Hermes orchestration layer at invocation time (not read from the process environment):

| Field                 | Description                                                          |
| --------------------- | -------------------------------------------------------------------- |
| `outlookClientId`     | Azure AD app client ID for Outlook access                            |
| `outlookClientSecret` | Azure AD app client secret                                           |
| `outlookTenantId`     | Azure AD tenant ID                                                   |
| `outlookUserId`       | Mailbox user ID or UPN to poll                                       |
| `resendApiKey`        | Resend API key for sending confirmation notification emails          |
| `resendSender`        | From address for confirmation notification emails (e.g. `noreply@…`) |

## Input body

| Field               | Type     | Default | Description                                      |
| ------------------- | -------- | ------- | ------------------------------------------------ |
| `maxMessagesPerRun` | `number` | `20`    | Maximum inbox messages to process per invocation |
| `watermark`         | `string` | —       | Cursor from the previous run (optional)          |

## Development

```bash
# from repo root
pnpm --filter @mediapulse/user-registration-agent dev
```
