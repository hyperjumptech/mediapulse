# user-registration agent

A Hermes agent that polls an Outlook inbox for newsletter subscription emails, processes registrations against the database via `agent-data-api`, sends confirmation notification emails via Resend, and confirms subscriptions through `agent-data-api`.

## What it does

1. Lists unread messages from the configured Outlook mailbox.
2. Parses the **subscriber email** from the message `From` address, the **ticker** from the subject (and body fallbacks), and the **display name** from the body (`Name:` from the current registration mailto, or legacy `Subscriber Name:`), using pipe/`Ticker:`/`---`/disclaimer boundaries so one-line mail clients do not swallow the footer into the name; then Graph `from.emailAddress.name` when usable, then a title-cased guess from the email local part.
3. Calls `agent-data-api POST /api/v1/user-registration-register` to create or update the `UserTicker` row.
4. For a **known** ticker, sends a Resend email on every processed signup: **new or unconfirmed** subscriptions get a confirmation email, then `agent-data-api POST /api/v1/user-registration-confirm` records the confirmation timestamp (no user action required). **Already confirmed** subscriptions get an “already subscribed” acknowledgment email and the confirm endpoint is **not** called again so `registration_confirmed_at` is not bumped on repeats.
5. Archives the processed message out of the inbox (best-effort) to keep the mailbox clear.

## Archiving and retries

- **Archive on success**: After a message is processed (including invalid/unparseable cases), the agent archives it so it does not remain in the primary inbox.
- **Confirm is best-effort**: If `user-registration-confirm` fails after a successful registration, the agent still archives the message to avoid repeated inbox clutter.
- **Register retry (bounded)**: The agent retries the register call once on transient failures (e.g. 429/5xx or network errors). If registration cannot be completed after the retry, the message is left unarchived so it can be retried on the next run.
- **Resend result envelope**: The Resend Node SDK resolves with `{ data, error }` and does not always reject when delivery is rejected. The agent treats `error` as a hard failure so it does **not** call `user-registration-confirm` after a failed send (otherwise the row could show confirmed with no email and nothing obvious in the Resend dashboard).

## Troubleshooting (Resend dashboard empty)

The Resend web app only shows activity for **HTTP requests that reached Resend’s API using that workspace’s API key**. If you see **no** rows at all for a signup you care about:

1. **Confirm the agent actually called Resend** — search your logs for `user-registration: calling Resend emails.send` and `user-registration: Resend emails.send accepted` (the latter includes `resendEmailId` when Resend returns an id). If neither appears for that mailbox message, the run never reached `emails.send` (e.g. no matching inbox message, parse failure, rate limit, register/render error, or wrong Resend project when comparing dashboards).
2. **Inbox selection** — The agent only lists messages that are **unread**, whose subject contains **`[MediaPulse] Newsletter Subscription`**, and (when a run passes a `watermark`) are **newer than the watermark**. A user-edited subject, an already-read draft, or a watermark past that message’s time means **zero messages** and therefore **no Resend traffic**, even if you created the user another way.
3. **API key / team** — Production must use the same Resend API key as the dashboard you are watching (staging vs production keys show different workspaces).

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
