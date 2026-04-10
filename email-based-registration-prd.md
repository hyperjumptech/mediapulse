# Email-Based Registration (Login-Less) PRD

## Document Control

- Product: MediaPulse
- Feature: Email-Based Registration — Public Site + User-Registration Agent
- Owner: Platform and Agents
- Status: Draft
- Last Updated: 2026-03-22

### Alignment with the repo (snapshot)

This section summarizes the **current** monorepo so requirements stay tied to real paths and models:

- **Public app:** [`apps/mediapulse/user-registration`](apps/mediapulse/user-registration) — package **`@mediapulse/user-registration`**. Run: `pnpm dev:user-registration` (port **3002**). Not `apps/user-registration`.
- **Mailto contract:** [`apps/mediapulse/user-registration/lib/tickers.ts`](apps/mediapulse/user-registration/lib/tickers.ts) — `buildMailtoUrl` uses subject `[MediaPulse] Newsletter Subscription - {KodeEmiten}`, body lines with ticker code/name, destination **`mediapulse@hyperjump.tech`** (still hardcoded in code; not yet env-driven).
- **Inbound agent:** **Not implemented.** There is no package under `apps/mediapulse/agents/` for user registration yet (existing agents: `data-collection`, `content-generation`, `delivery`, `ticker-echo`).
- **Outlook client library:** [`packages/mediapulse/outlook-inbox`](packages/mediapulse/outlook-inbox) — package **`@mediapulse/outlook-inbox`** (not `@workspace/outlook-inbox`). Docs: same folder `README.md` and `MICROSOFT-SETUP.md`.
- **Mediapulse DB subscribers:** [`packages/mediapulse/database/prisma/schema.prisma`](packages/mediapulse/database/prisma/schema.prisma) — **`MediapulseUser`** (`mediapulse_user` table): `email` (unique), optional `name`, **no `password` field**. **`UserTicker`** links users to **`Ticker`** (`symbol` unique, `name`). This matches a login-less funnel without storing credentials for subscribers.
- **Hermes admins:** Orchestration **`User`** in the Hermes database is for **dashboard/admin** accounts only; do **not** use it for newsletter subscribers (see [dev-docs user-registration page](dev-docs/docs/mediapulse/apps/user-registration.mdx)).
- **Env:** Mediapulse apps/agents use **`@mediapulse/env`** (not `@workspace/env` for this domain). Optional Outlook vars are already defined on the main Mediapulse env object (`OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_TENANT_ID`, `OUTLOOK_USER_ID`) in [`packages/mediapulse/env/src/index.ts`](packages/mediapulse/env/src/index.ts).
- **Outbound email reference:** [`apps/mediapulse/agents/delivery`](apps/mediapulse/agents/delivery) — package **`@mediapulse/delivery`**, uses **Resend** with plain `text` bodies via [`packages/mediapulse/env/src/agents-delivery.ts`](packages/mediapulse/env/src/agents-delivery.ts) (`RESEND_API_KEY`, `RESEND_SENDER`). There is **no** shared `@workspace/email-templates` package in this repo today; new transactional copy can follow the same Resend pattern or add templates later.

## Background

MediaPulse delivers ticker-specific newsletters to subscribers. A **login-less** onboarding path lets users subscribe without creating a password: they visit a public site, pick a stock ticker, and their email client opens with a **prefilled** destination address, subject, and body. Sending that email proves control of the mailbox and conveys the chosen ticker in a machine-parseable way.

Today:

- **`@mediapulse/user-registration`** is a Next.js app that loads tickers from `public/tickers.json`, lets the user search/select a ticker, and builds a **`mailto:`** URL with fixed subject/body patterns (see `lib/tickers.ts`). The destination is currently **hardcoded** in `buildMailtoUrl` (`mediapulse@hyperjump.tech`).
- **Inbound processing is not implemented:** there is no automated job that reads the shared inbox and creates database records.
- **`@mediapulse/outlook-inbox`** exposes Microsoft Graph–backed listing, filtering (subject, date, unread), and archive/delete for a designated mailbox — suitable for a periodic **user-registration agent** running under Hermes.
- **Database:** Subscriber rows are **`MediapulseUser`** + **`UserTicker`** (see schema). There is **no** password column on **`MediapulseUser`**; login-less registration should **not** introduce password storage for this flow unless product explicitly adds credential-based login later.

**Inbound path (v1):** A **single** shared mailbox (e.g. `mediapulse@…`) receives all registration emails. The agent connects with **app-only** Microsoft Graph credentials and the mailbox identifier expected by `@mediapulse/outlook-inbox` (e.g. `OUTLOOK_USER_ID`). It runs on a **periodic Hermes schedule** (e.g. every **5–15 minutes** — exact default in Hermes seed/config); **Graph push webhooks are out of scope for v1.** The agent **lists** messages whose **subject** matches the registration pattern used by `buildMailtoUrl` (e.g. contains `[MediaPulse] Newsletter Subscription` and the ticker code), **parses** sender and ticker from subject and/or body, then **archives** each inbound message when processing for that message is complete — including **confirmation email** on successful new registration, **invalid-ticker** notice when applicable, and **idempotent duplicate** handling (see **FR7**). **Idempotency** uses a natural key such as `(subscriber email, ticker id)` — upsert or skip with a structured log.

This PRD ties the public mailto flow to that **scheduled agent** so registrations **create or update** subscription state without duplicate `UserTicker` rows.

## Problem Statement

Without server-side ingestion, registration emails sit unread and **no `MediapulseUser` / `UserTicker` rows** are created — the pipeline cannot know who subscribed or for which ticker. Operators cannot rely on the mailto UX alone for a complete signup funnel.

## Goals

- **End-to-end registration:** mailto from `@mediapulse/user-registration` → user sends email → agent processes the shared inbox → for a **valid** ticker, **`MediapulseUser`** and **`UserTicker`** exist with correct **email ↔ ticker** association, and the user receives a **simple confirmation email** (Resend, same patterns as **`@mediapulse/delivery`**). Set **`name`** from the sender’s **email local-part** (with truncation/sanitization) or leave **`name`** unset / use a short fallback if product prefers — **no password** for this flow.
- **Public UX:** **mailto** remains the primary mechanism. The site asks users **not** to change subject or body; the **parser should still tolerate** reasonable variance (implementation-defined strict vs tolerant rules).
- **Hermes-scheduled agent:** a **`user-registration`** agent runs on the **periodic schedule** described in Background via Hermes / **hermes-worker** / DataQueue (same family as other scheduled agents).
- **Reuse `@mediapulse/outlook-inbox`** for list/filter/archive of registration messages.
- **Invalid ticker:** if the parsed code does **not** resolve to a **`Ticker`** (match on **`symbol`** after normalization), **do not** create **`MediapulseUser`** or **`UserTicker`**; **send one outbound email** to the sender explaining the ticker is invalid and asking them to **select a valid ticker** on the registration site, then **archive** the inbound message.
- **Idempotent, safe processing:** the same **email + ticker** must not create duplicate **`UserTicker`** rows; transient Graph/API failures should be retryable on the next run.
- **Observable outcomes:** structured logging and, where the platform supports it, agent run diagnostics (success/partial/failure) for operators.

## Non-Goals

- **Password-based login or OAuth** for this flow in v1 (explicitly login-less; dashboard access for these users may be limited or deferred).
- **Real-time** processing (sub-minute latency); periodic polling is acceptable.
- **Non-Outlook / non-Graph** inboxes in v1 (IMAP or other providers can be a later phase if needed).
- **Spam or abuse prevention** beyond basic validation, rate limits, and optional manual review (detailed anti-abuse is a follow-on).
- Changing the **content-generation** or **delivery** agents beyond what is needed to consume new subscriber data.

## Users and Stakeholders

- **End users:** subscribe via mailto without managing MediaPulse accounts in the browser.
- **Hermes admins:** configure agent schedule, mailbox-related secrets (via env/Hermes patterns), and monitor runs.
- **Platform engineers:** maintain Prisma schema, agent package, env docs, and `outlook-inbox` integration.

## Functional Requirements

### FR1: Mailto Contract (Public Site)

- **`@mediapulse/user-registration`** continues to produce a **`mailto:`** URL with:
  - **To:** configurable registration address (env or build-time constant — must match the **single** monitored shared mailbox). _Today: hardcoded in `buildMailtoUrl`; moving to env is recommended._
  - **Subject:** includes a **stable, parseable** pattern including **ticker code** (current: `[MediaPulse] Newsletter Subscription - {KodeEmiten}`).
  - **Body:** includes **ticker code and company name** on dedicated lines for human review and optional secondary parsing.
- Copy should ask users **not** to edit subject or body before send; the agent parser must still support **tolerant** matching where product rules allow.
- Document the exact contract in dev-docs and keep **site + agent parsers** in sync (shared constant package or single source of truth recommended).

### FR2: User-Registration Agent — Inbox Fetch

- Agent runs on a **periodic Hermes schedule** (hermes-worker executes DataQueue jobs per existing platform pattern); **not** driven by Graph webhooks in v1.
- Uses **`createOutlookInboxClient`** with **app-only** Graph credentials and mailbox scoping per [`@mediapulse/outlook-inbox` docs](packages/mediapulse/outlook-inbox/README.md) (e.g. `OUTLOOK_USER_ID`), with secrets from **`@mediapulse/env`** (no `process.env` in app code — per repo standards).
- **`listMessages`** with filters aligned to the mailto contract (e.g. **`subjectContains`** the fixed prefix such as `[MediaPulse] Newsletter Subscription`, **`isUnread: true`**, optional **`receivedAfter`** watermark).
- Respects **pagination** (`top`) and a **max messages per run** cap to bound runtime.

### FR3: Parsing and Validation

- For each candidate message:
  - Extract **sender email** from Graph message (`from` / `sender`).
  - Extract **ticker code** from subject (primary) with fallback to body lines if subject altered slightly — document **strict vs tolerant** rules.
  - **Missing ticker, missing/invalid sender, or unusable template:** log, **do not** send the invalid-ticker email; leave message unarchived or follow a defined dead-letter behavior (implementation-defined minimal handling).
  - **Unknown ticker** (parsed code does not resolve to a **`Ticker`** row after normalization to **`symbol`**): **send** the invalid-ticker outbound email (**FR6**), **archive** the inbound message (**FR7**), **no** `MediapulseUser` / `UserTicker` writes.
- **Sanitize** inputs before DB writes (length limits, normalization of email).

### FR4: Database Writes (valid ticker only)

- When the ticker **resolves** to a **`Ticker`** row, **find or create `MediapulseUser`:**
  - **`email`** from sender (normalized).
  - **`name`** = **local-part** of that email (substring before `@`), with safe length truncation and sanitization; or **`null`** / omitted if empty — product choice (e.g. fallback label `"Subscriber"` only if a non-null name is required elsewhere).
- **Find or create `UserTicker`** for `(userId, tickerId)` with `enabled: true`.
- **Idempotent:** repeated processing of the same logical registration must not create duplicate `UserTicker` rows (DB already enforces `@@unique([userId, tickerId])`).
- When the ticker is **unknown**, **no** `MediapulseUser` / `UserTicker` writes — see **FR6** and **FR7**.
- Optionally record **audit metadata** (e.g. `receivedAt`, Graph `messageId`) — implementation-defined.

### FR5: Outbound Email — Registration Confirmation (valid ticker)

- After **`MediapulseUser` / `UserTicker`** persistence **succeeds** for a **new or updated** subscription (i.e. the agent performed work, not a pure **idempotent no-op** where the same subscription was already in place), send a **simple confirmation email** to the user’s address (e.g. **Resend**, same stack as **`@mediapulse/delivery`**).
- **Content (minimal v1):** acknowledge **successful registration**, include the **ticker symbol** (and optionally company name) they subscribed to; no marketing requirements beyond clarity.
- **Duplicate inbound messages:** if processing is skipped because `(email, ticker)` is **already satisfied** with nothing to update, **do not** send another confirmation (avoids spam on mailbox reprocessing).
- **Failure handling:** if confirmation **send fails**, **do not** archive the inbound message until send succeeds or a documented retry policy completes (**FR7**) — same principle as the invalid-ticker path.

### FR6: Outbound Email — Invalid Ticker

- When the ticker is **unknown**, send a **single** transactional email to the user’s address using the same outbound mechanism as **FR5** (e.g. **Resend** via `@mediapulse/env` patterns; mirror **`agents-delivery`** or add a dedicated **`agents-user-registration`** env slice if needed).
- **Content:** clearly state that the **ticker could not be matched**, and ask them to **visit the registration site and select a valid ticker** from the list (no need to list all tickers in the email).
- **Configuration:** sender/from, optional reply-to to the shared registration mailbox — document in the appropriate `env.example` and rebuild `@mediapulse/env`.
- **Idempotency:** sending must not repeat every run for the same inbound message; **archiving** the inbound message after a successful send closes the loop.

### FR7: Post-Processing Inbox

- **Archive** the inbound registration message once handling is complete:
  - **Valid ticker, new or updated subscription:** **confirmation email successfully sent** (**FR5**) after **FR4** (or queued with retry — do not archive until confirmation succeeds if product requires it), **or**
  - **Valid ticker, idempotent no-op** (already subscribed — **FR5** skipped): **archive** without resending confirmation so the message is not reprocessed indefinitely, **or**
  - **Invalid ticker:** **FR6** sent successfully.
- Prefer **synchronous send + archive on success**; document behavior if queue-based.
- On **failure** after partial batch, do not archive failed items; leave them for the next run.

### FR8: Hermes Integration

- Register agent (auto) in **`AgentRegistry`** with **`agentId`** e.g. `user-registration`, version, **`configSchema`** for:
  - polling interval overrides (if not only schedule-driven),
  - `maxMessagesPerRun`,
  - optional subject/body pattern overrides for testing.
- Pipeline step or standalone schedule: **invoke agent** on the chosen cadence; document required env for deployment (Outlook secrets, database URL, Resend).
- **Suggested location:** `apps/mediapulse/agents/user-registration/` (same layout as `delivery`, `data-collection`, etc.), using **`createAgentApp`** from **`@workspace/agent-runtime`**.

### FR9: Configuration and Secrets

- Extend **`env.example`** and **`@mediapulse/env`** for all Outlook-related variables used by the agent (`OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_TENANT_ID`, `OUTLOOK_USER_ID`, etc.) per [`packages/mediapulse/outlook-inbox` README](packages/mediapulse/outlook-inbox/README.md) and [MICROSOFT-SETUP.md](packages/mediapulse/outlook-inbox/MICROSOFT-SETUP.md).
- Include **outbound email** variables for **confirmation** and **invalid-ticker** messages (same family as delivery: e.g. `RESEND_API_KEY`, `RESEND_SENDER` — exact names per repo conventions, possibly a dedicated env export for this agent).
- Document **Mail.Read** vs **Mail.ReadWrite** needs (listing + archive implies write — align with package permissions).

## Non-Functional Requirements

### NFR1: Security

- **Secrets** remain server-only; never `NEXT_PUBLIC_` for Graph or Resend credentials.
- **Least privilege:** Graph permissions limited to what `outlook-inbox` requires for list + archive.
- **PII:** logs must not dump full message bodies in production; redact where possible.

### NFR2: Reliability

- Agent failures must **not** corrupt data: use transactions for multi-row writes where applicable.
- **Bounded** runtime per schedule tick (message caps, timeouts on Graph calls).

### NFR3: Testing

- **Unit tests:** parsing functions (subject/body → ticker + email), idempotency helpers, mock Graph client, **local-part → name** edge cases, confirmation and invalid-ticker email content (if extracted to pure functions).
- **Integration tests** optional for v1; manual E2E with test mailbox documented.

## Risks and Mitigations

| Risk                                                   | Mitigation                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Users edit subject/body                                | Tolerant parsing + clear UX copy; optional “resend” or support path                            |
| Graph rate limits                                      | Batch sizes, backoff, schedule not too aggressive                                              |
| Resend failures on invalid-ticker or confirmation path | Retry outbound send or leave message unarchived until send succeeds (document chosen behavior) |
| Shared mailbox abuse                                   | Future: rate limits, blocklists, CAPTCHA on site (out of v1 scope)                             |

## Success Metrics

- Registration emails result in **correct `MediapulseUser` and `UserTicker` rows** and a **delivered confirmation email** within one agent cycle when the ticker is valid and the subscription is newly applied.
- Invalid tickers result in a **delivered** explanatory email and **no** new `MediapulseUser` / `UserTicker` rows.
- **Zero duplicate** `UserTicker` rows for the same email+ticker from repeated agent runs.
- **Hermes** shows successful recurring executions without sustained error spikes.

## Appendix A: Reference Implementation Touchpoints

- Public UI: [`apps/mediapulse/user-registration/components/registration-form.tsx`](apps/mediapulse/user-registration/components/registration-form.tsx), [`apps/mediapulse/user-registration/lib/tickers.ts`](apps/mediapulse/user-registration/lib/tickers.ts) (`buildMailtoUrl`).
- Outlook integration: [`packages/mediapulse/outlook-inbox`](packages/mediapulse/outlook-inbox).
- Scheduler / worker: [`apps/hermes/worker`](apps/hermes/worker), [`packages/hermes/scheduler`](packages/hermes/scheduler).
- Outbound email patterns: [`apps/mediapulse/agents/delivery`](apps/mediapulse/agents/delivery) (Resend + `@mediapulse/env/agents-delivery`).
- Data models: [`packages/mediapulse/database/prisma/schema.prisma`](packages/mediapulse/database/prisma/schema.prisma) — **`MediapulseUser`**, **`Ticker`**, **`UserTicker`**.
- Dev docs: [`dev-docs/docs/mediapulse/apps/user-registration.mdx`](dev-docs/docs/mediapulse/apps/user-registration.mdx) (may need refresh to match `@mediapulse/env` and this PRD).

## Appendix B: Suggested Agent Package Layout

- New app under **`apps/mediapulse/agents/user-registration/`**, consuming **`@mediapulse/outlook-inbox`**, **`@mediapulse/database`**, **`@mediapulse/env`**, outbound email (Resend) consistent with **`@mediapulse/delivery`**, and **`@workspace/agent-runtime`** (same bootstrap as sibling Mediapulse agents).

---

_End of PRD_
