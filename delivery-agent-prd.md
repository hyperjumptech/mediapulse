# Delivery Agent PRD

## Document Control

- Product: MediaPulse
- Feature: Delivery Agent (Configurable, HTML Email, Resilience, Observability)
- Owner: Platform and Agents
- Status: Draft (requirements below; **implementation gap** vs repo — see [Current implementation snapshot](#current-implementation-snapshot))
- Last Updated: 2026-03-22

## Current implementation snapshot

_As of repo state reviewed 2026-03-22 (see `apps/mediapulse/agents/delivery`, `apps/mediapulse/agent-data-api`, `@workspace/agent-data-api-contract`)._

| Area                                     | Today                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent package**                        | `@mediapulse/delivery` — `createAgentApp` with `agentId: "delivery"`, `agentVersion: "1.0.0"`, input `{ tickerId: uuid }`. **No `configSchema`** (unlike `content-generation`, which exposes Hermes-driven config).                                                 |
| **agent-data-api**                       | Typed manifest resource `delivery`: **GET** loads latest `newsletter` for `tickerId` + enabled `userTicker` subscribers (emails from Mediapulse users). **POST** body `{ userTickerId }` — handler calls `postDelivery`, which is **ack-only** (no DB write today). |
| **GET when no newsletter**               | API returns **404** (`notFound`). The SDK throws on non-2xx; the agent run fails with **500**, not a success skip.                                                                                                                                                  |
| **Code path `"Skipped: no newsletter"`** | Present in `run`, but with the current API **404 + client throw** it is **not exercised**; a future 200 + optional newsletter contract would be needed for graceful skip, or the agent should treat 404 as skip (product/API change).                               |
| **Subscribers**                          | If there is a newsletter but **zero** subscriber emails after filtering, the agent **does not** send mail but still **POST**s delivery (`delivery.create`).                                                                                                         |
| **Email**                                | `resend.emails.send` with **`text` only** (`newsletter.content`); **no `html`**. Sequential loop; **fixed 2000 ms** delay after each recipient (`send-email-to-users.ts`).                                                                                          |
| **Env**                                  | `@mediapulse/env/agents-delivery`: `RESEND_API_KEY`, `RESEND_SENDER`, `AGENT_DATA_API_URL`, `AGENT_AUTH_API_URL`, optional auto-register fields (`AGENT_REGISTRY_URL`, `AGENT_PUBLIC_URL`, `DOMAIN_INTEGRATION_*`). Default **port 4003**.                          |
| **React Email / templates**              | **No** `email-templates` (or equivalent) package in the monorepo yet.                                                                                                                                                                                               |
| **Retries / rate limiting**              | None beyond sequential pacing; first `resend.emails.send` rejection fails the loop.                                                                                                                                                                                 |
| **Diagnostics / Hermes UI**              | No persisted delivery-run diagnostics model and **no** Hermes admin surface for delivery runs (pipeline seed references `agentId: "delivery"` only).                                                                                                                |
| **HTTP contract paths**                  | Client uses manifest paths, e.g. **`/api/v1/delivery`** (not a bare `/delivery` root).                                                                                                                                                                              |

This PRD’s **Goals** and **FRs** remain the **target**; the Background section below describes the **current pain** in product terms, aligned with the snapshot where it differs from earlier assumptions.

## Background

The `delivery` agent loads newsletter and subscriber data from **agent-data-api** (GET on the manifest `delivery` resource, e.g. `/api/v1/delivery?tickerId=…`), sends email via **Resend** using `newsletter.subject` and `newsletter.content`, then calls **POST** on the same resource with `{ userTickerId }` (ack-only server-side today). In the **current** codebase:

- **Email body** is **plain text only** (`text`); there is no HTML part or branded layout.
- **Resend settings** (`RESEND_API_KEY`, `RESEND_SENDER`) and behavior (sequential sends, fixed **2s** `setTimeout` between recipients) are **environment- and code-fixed**, not admin-tunable in Hermes (no delivery `configSchema` on the agent).
- **No newsletter for ticker:** data-api returns **404**; the typed client throws and the agent run typically ends in **500** — not a user-visible “skipped” success in Hermes.
- **Failures** (Resend rate limits, transient API errors, partial send batches) surface primarily as **logs** and failed runs; Hermes admins lack a **first-class** view of per-run outcomes, per-recipient errors, or retry history.
- There is **no structured retry** policy beyond whatever the HTTP client implies; a single failed `resend.emails.send` can fail the whole run without partial progress reporting.

This PRD defines improvements so delivery is **globally configurable in Hermes**, sends **HTML email** built with **React Email** (with sensible plain-text fallback), **rate-limits and retries** Resend calls to reduce failures, and exposes **error visibility** to admins in Hermes.

## Problem Statement

Operators cannot tune sender identity, throughput, or retry behavior without releases. Subscribers receive plain text only, which limits branding and readability. When Resend returns **429** or transient errors, operators cannot easily see **which recipients failed**, whether the run **partially succeeded**, or **what to do next** without log diving.

## Goals

- Expose **global** Hermes configuration for delivery (sender defaults, rate limits, batching, retry policy, optional feature flags) and align **secrets** with platform patterns (Hermes-managed where applicable; env fallback documented for local dev).
- Generate **HTML** email using **React Email** (planned `@workspace/email-templates`), with a **deterministic plain-text** alternative derived from the same content model (accessibility and client compatibility).
- **Rate-limit** outbound Resend requests to stay under provider limits and reduce **429** failures; replace the fixed 2s sleep with **configurable** pacing (token bucket or min interval + optional concurrency cap).
- Implement **bounded retries** for **transient** Resend errors (429 with `Retry-After`, 5xx, network timeouts) with **jittered backoff**; classify **non-retryable** errors (4xx except rate limit) to fail fast with clear diagnostics.
- Persist **structured run diagnostics** (success, partial success, failure, skip) and expose a **minimal Hermes UI** for admins (recent runs, filters, per-recipient error summaries — details per FRs below).

## Non-Goals

- **Per-subscriber** or **per-ticker** configuration overrides in v1 (global config only).
- **Outbound alerting** (Slack, PagerDuty, email to ops) in v1 — Hermes UI + logs + persisted diagnostics only.
- **Full marketing ESP** features (A/B subjects, click tracking beyond what Resend provides, visual drag-and-drop editors).
- Changing the **content-generation** agent’s output format beyond what is needed to **render** HTML (additive fields optional; see API section).
- **Guaranteed exactly-once** email delivery (email providers are at-least-once; v1 targets **clear semantics**: record attempts, retries, and final per-recipient outcome in diagnostics).

## Users and Stakeholders

- **Hermes admins:** configure sender, rate limits, retries; inspect failed or partial delivery runs.
- **Agent operators:** monitor Resend health, rate-limit behavior, and subscriber impact.
- **Subscribers:** receive readable HTML newsletters with consistent branding.
- **Platform engineers:** maintain `agent-data-api` contracts (`@workspace/agent-data-api-contract`), `@mediapulse/delivery`, a future `@workspace/email-templates` package (skill: `.cursor/skills/email-template/SKILL.md`; path `packages/email-templates/` when added), and `@workspace/agent-runtime`.

## Resolved Product Decisions (v1)

| Topic           | Decision                                                                                                                                                                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config scope    | **Global only** — one active delivery configuration for all tickers.                                                                                                                                                                                                                                                          |
| HTML authoring  | **React Email** in **`@workspace/email-templates`** (`packages/email-templates/` — **not created yet**; see `.cursor/skills/email-template/SKILL.md`), rendered server-side in the delivery agent (or a small shared renderer module).                                                                                        |
| Plain text      | **Always send both** `html` and `text` on Resend when both are available; text must be **safe and readable** (derived from structured content or markdown-to-text rules — implementation-defined).                                                                                                                            |
| Rate limiting   | **Configurable** min interval between API calls and/or **max sends per minute**; optional **max concurrent** in-flight calls if batching is introduced later. Default must be **safer than** unbounded sequential calls.                                                                                                      |
| Retries         | **Bounded** retries for classified transient errors only; **no infinite retry**.                                                                                                                                                                                                                                              |
| Partial success | **Allowed** when some recipients succeed and others fail after retries — run outcome **`partial_success`** with per-recipient rows in diagnostics (see FR4). Whether the pipeline step is HTTP **200** vs **207**-style is an implementation detail aligned with `@workspace/agent-runtime` conventions (must be documented). |
| Secrets         | **Resend API key**: Hermes-managed in production per platform standard; **env** (`RESEND_API_KEY`) allowed for local/dev with documentation.                                                                                                                                                                                  |

## Functional Requirements

### FR1: Hermes Global Configuration Schema

- The `delivery` agent loads a **Zod-validated** config from the standard Hermes/runtime config path used by other agents (same `createAgentApp` + `GET /schemas` pattern as e.g. `content-generation`).
- **Today:** the delivery agent passes **no** `configSchema` — Hermes cannot supply per-run config keys until this FR is implemented.
- **Required conceptual groups:**
  - **Resend / identity:** default `from` (must remain compatible with Resend domain verification), optional `replyTo`, optional `tags` or metadata for Resend dashboards (non-secret).
  - **Rate limiting:** `minIntervalMs` between `emails.send` calls **and/or** `maxSendsPerMinute` (implement one coherent model — document the chosen algorithm).
  - **Retry:** `maxAttempts`, `baseDelayMs`, `maxDelayMs`, `jitter`; map Resend/HTTP errors to **retryable** vs **fatal**.
  - **Template:** identifier for which React Email template to use for newsletters (v1 may ship **one** default template + optional **variant** key).
- Config must expose **JSON Schema** (or equivalent) for Hermes forms with `agentId: "delivery"`.
- **Invalid config** at runtime must fail fast with structured errors and diagnostics (no silent unsafe defaults).

### FR2: HTML Email via React Email

- Add `@workspace/email-templates` (`packages/email-templates/` per `.cursor/skills/email-template/SKILL.md`) with a **Newsletter** (or similarly named) React Email template: layout, typography, header/footer, unsubscribe placeholder if applicable.
- **Render** HTML with `@react-email/render` (or current standard in repo after skill alignment).
- **Plain text:** generate via `render` with plain-text option **or** a dedicated text serializer from the same props — avoid drifting HTML and text content unintentionally.
- **Input mapping:** map `newsletter.subject` and `newsletter.content` (and any additive API fields such as sections or CTA links if introduced) into template props. If `content` is markdown or HTML today, document the **parsing rules** (sanitize HTML for email clients).

### FR3: Rate-Limited Resend Client

- Replace the fixed **2 second** delay with **config-driven** pacing integrated with the retry layer.
- Enforce limits **before** each `emails.send` so burst traffic from multiple pipeline runs does not trivially exceed limits (document whether limits are **per process** only in v1).
- Emit structured logs: `waitMs` applied, `attempt`, `recipientHash` or opaque id (not raw PII if policy requires redaction).

### FR4: Retries and Outcome Taxonomy

- Classify errors (extend as needed):
  - `skipped_no_newsletter` / `skipped_no_subscribers` → **skipped** (**target** taxonomy; **today** no newsletter yields **404 → failed agent run**, not a skip outcome).
  - `resend_rate_limited` → **retry** respecting `Retry-After` when present.
  - `resend_transient` → **retry** per policy.
  - `resend_non_retryable` → **fail** recipient (or whole run — product choice: **per-recipient failure** preferred for v1).
  - `data_api_transient` / `data_api_client_error` → map per HTTP semantics.
- **Partial success:** if at least one recipient succeeds and at least one fails after retries, persist **`partial_success`** with counts and lists of failed addresses **or** stable subscriber ids (privacy review: prefer ids if available in API).

### FR5: Persisted Diagnostics

- Each invocation creates/updates a **diagnostic record** accessible to Hermes (storage follows platform standard). **Today:** no such records or tables exist for delivery; introduce the pattern here or align with whichever agent diagnostics storage lands first.
- Minimum fields:
  - `agentId` (`delivery`), `agentVersion`, `tickerId`
  - `outcome`: `success` | `skipped` | `failed` | `partial_success`
  - `stage` when applicable: `fetch`, `render`, `send`, `persist_delivery_record`
  - `resendRequestIds` or Resend ids when returned (for support correlation)
  - Per-recipient: `email` or `subscriberId`, `status`, `attempts`, `lastErrorCode`, `lastErrorMessage` (sanitized)
  - `createdAt`, `durationMs`, correlation id from Hermes when available
- **Logs** remain supplemental.

### FR6: Minimal Hermes Admin UI

- Hermes exposes a **read-only** minimal surface for `delivery`:
  - table of recent runs (time, ticker, outcome, recipient counts)
  - filters: time range, ticker, outcome
  - detail: error summary, link to Resend message ids if stored, expandable per-recipient failures
- No “replay send” button required in v1 (phase 2).

### FR7: Post-Send Persistence Semantics

- Today the agent calls **`delivery.create`** (`POST` with `{ userTickerId }`) after the send loop; **`postDelivery` is a no-op** in the data-api service (no Prisma write). Define behavior for **partial_success** and real persistence:
  - **Decision (v1):** still record delivery **checkpoint** in a way that avoids **duplicate sends** to successful recipients on blind replay (implementation may require **idempotent** delivery records or explicit **run id** — if schema changes are needed, follow additive API + Prisma migration practices).
- Document the chosen behavior in dev-docs and this PRD’s implementation notes.

### FR8: Backward Compatibility

- Pipeline input **`{ tickerId }`** remains valid.
- If HTML is added, **API** may remain text-centric if rendering happens entirely in delivery; optional additive fields on newsletter for structured sections are **nice-to-have**, not required for v1 if markdown/HTML parsing of `content` is sufficient.

## Proposed Config Shape (v1)

```json
{
  "resend": {
    "from": "Newsletter <newsletter@example.com>",
    "replyTo": "support@example.com"
  },
  "rateLimit": {
    "minIntervalMs": 600,
    "maxSendsPerMinute": 8
  },
  "retry": {
    "maxAttempts": 4,
    "baseDelayMs": 500,
    "maxDelayMs": 20000,
    "jitter": true
  },
  "template": {
    "newsletterVariant": "default"
  }
}
```

_(Exact numbers are starting points; tune to Resend plan limits and production metrics.)_

## API and Contract Considerations

- **agent-data-api:** paths are versioned under the shared manifest (e.g. `/api/v1/delivery`). **GET** query `tickerId`; **POST** body uses **`userTickerId`** (string) today — naming is historical; keep or migrate with additive versioning if needed. Additive extensions if diagnostics persistence lives server-side (e.g. `delivery_run` records) — follow **agent-data-api** skill for contract, SDK, handlers, tests, dev-docs.
- **Newsletter payload:** optional additive fields (`contentFormat`, structured blocks) only if plain `content` is insufficient for React Email; prefer **minimal** changes for v1.
- **Secrets:** if Hermes supplies `resend.apiKey`, document precedence vs `RESEND_API_KEY` env (mirror content-generation OpenAI pattern). **Today:** only env-based Resend credentials in `@mediapulse/env/agents-delivery`.

## Observability

- Structured logs: fetch start/end, render duration, each send attempt outcome, rate-limit waits, final aggregate outcome.
- Never log full API keys; redact tokens in error messages persisted to Hermes.

## Acceptance Criteria

- Admins can configure **global** delivery settings in Hermes (sender, rate limit, retry policy, template variant) without redeploying for routine changes.
- Outbound email includes **HTML** from React Email and a **text** alternative; messages pass Resend validation.
- Resend calls respect **configured rate limits**; transient failures are **retried** within bounds.
- Failures and partial successes produce **persisted diagnostics** visible in **Hermes**; logs are secondary.
- Unit/integration tests cover rate limiter, retry classification, and render pipeline (co-located tests per repo standards).

## Rollout Plan

1. **Scaffold** `@workspace/email-templates` (`packages/email-templates/`) and wire `render` in delivery behind a feature flag or config toggle if needed for safe rollout.
2. **Implement** rate limiter + retry wrapper around Resend; remove hardcoded 2s delay.
3. **Persist diagnostics** + Hermes UI (minimal).
4. **Docs:** dev-docs for config keys, operational runbook (Resend dashboard + Hermes diagnostics), and semantics for partial success / idempotency.

## Phase 2 (Out of Scope for This PRD)

- Per-ticker or workspace overrides.
- Proactive alerts on repeated delivery failures.
- Distributed rate limiting across multiple delivery agent replicas.
- Admin “retry failed recipients” action.

## Risks and Mitigations

| Risk                                                       | Mitigation                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------- |
| HTML increases spam/trust issues if content is unsanitized | Sanitize/limit HTML; strict template; lint in CI                    |
| Partial success confuses pipeline “green” semantics        | Document HTTP outcome mapping; show partial state clearly in Hermes |
| Rate limits still hit under multi-tenant load              | Tune defaults; phase-2 distributed limiter; monitor Resend metrics  |
| PII in diagnostics                                         | Prefer subscriber ids; redact emails in UI if policy requires       |
