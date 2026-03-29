# user-registration agent

A Hermes agent that polls an Outlook inbox for newsletter subscription emails, processes registrations against the database via `agent-data-api`, and sends opt-in confirmation emails via Resend.

## What it does

1. Lists unread messages from the configured Outlook mailbox.
2. Parses the sender email and desired ticker symbol from each message.
3. Calls `agent-data-api POST /api/v1/user-registration-register` to create or update the `UserTicker` row.
4. When the subscription is new or unconfirmed, sends an opt-in email with a confirmation link (Resend).
5. Marks each processed message as read and moves it out of the inbox.

## Environment variables

| Variable            | Required | Description                                              |
| ------------------- | -------- | -------------------------------------------------------- |
| `PORT`              | No       | HTTP port (default `3000`)                               |
| `AGENT_DATA_API_URL`| Yes      | Base URL for `agent-data-api`                            |

## Hermes config fields

These are supplied by the Hermes orchestration layer at invocation time (not read from the process environment):

| Field                  | Description                                             |
| ---------------------- | ------------------------------------------------------- |
| `outlookClientId`      | Azure AD app client ID for Outlook access               |
| `outlookClientSecret`  | Azure AD app client secret                              |
| `outlookTenantId`      | Azure AD tenant ID                                      |
| `outlookUserId`        | Mailbox user ID or UPN to poll                          |
| `resendApiKey`         | Resend API key for sending opt-in emails                |
| `resendSender`         | From address for opt-in emails (e.g. `noreply@…`)       |

## Input body

| Field               | Type     | Default | Description                                      |
| ------------------- | -------- | ------- | ------------------------------------------------ |
| `maxMessagesPerRun` | `number` | `20`    | Maximum inbox messages to process per invocation |
| `watermark`         | `string` | —       | Cursor from the previous run (optional)          |

## Development

```bash
# from repo root
pnpm --filter @mediapulse/agents-user-registration dev
```
