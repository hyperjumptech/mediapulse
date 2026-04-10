# Content Generation Agent PRD

## Document Control

- Product: MediaPulse
- Feature: Content Generation Agent (Configurable & Observable)
- Owner: Platform and Agents
- Status: Draft (requirements below; see **Implementation snapshot** for what is shipped in-repo today)
- Last Updated: 2026-03-22

## Background

The `content-generation` agent (`apps/mediapulse/agents/content-generation`) loads analyzed data sources for a ticker from **agent-data-api**, calls OpenAI, validates JSON output, formats newsletter body text, and persists a `Newsletter` row via the content-generation **create** API.

Hermes pipelines invoke this agent after **analysis** and before **delivery** (e.g. seeded pipeline `Analysis & Newsletter`: `analysis` → `content-generation` → `delivery` in `apps/hermes/dashboard/scripts/seed-kg-pipelines.ts`).

### Implementation snapshot (repository, 2026-03-22)

What exists **today** versus this PRD’s **target** state:

| Area                        | Current behavior                                                                                                                                                                                                                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenAI credentials**      | **`openaiApiKey`** (required) and optional **`openaiModel`** come from the **Hermes invocation `config` payload**, validated by `ContentGenerationConfigSchema` in `src/config-schema.ts`. They are **not** read from `@mediapulse/env` — the generated env module (`packages/mediapulse/env` agents-content-generation) has **no** `OPENAI_API_KEY`. |
| **Prompts & sampling**      | System and user messages are **hardcoded** in `src/index.ts` (`generateContentWithOpenAI`). The model defaults to **`gpt-4o-mini`** when `openaiModel` is omitted. No configurable temperature, `maxTokens`, timeouts, or prompt templates in config yet.                                                                                             |
| **Output shape**            | LLM is instructed to return **exactly 3** `topNews` items; code uses `slice(0, 3)`. Not configurable via `topNewsCount` yet.                                                                                                                                                                                                                          |
| **GET data sources**        | `agent-data-api` `getDataSourcesForTicker` returns sources with **today’s** selected relevance scores using a **UTC calendar-day** start (`setUTCHours(0,0,0,0)`), not an operator-selected IANA timezone.                                                                                                                                            |
| **Newsletter persistence**  | `postContentGenerationBodySchema` / Prisma `Newsletter`: **subject**, optional **description**, **content**, **tickerId** only — **no** provenance or token-usage fields yet (`packages/mediapulse/database`, `@workspace/agent-data-api-contract`).                                                                                                  |
| **Idempotency**             | **No** skip-if-fresh; a successful run always attempts OpenAI (if sources exist) and **creates another row** on each successful persist.                                                                                                                                                                                                              |
| **Retries**                 | **No** bounded LLM retry loop or persist-retry policy; a single OpenAI call; persist failure **rethrows** → agent returns **500**.                                                                                                                                                                                                                    |
| **Runtime HTTP contract**   | `@workspace/agent-runtime` `createAgentApp`: logical success and “expected” failure (e.g. no sources) both return **HTTP 200** with `HermesInvokeEnvelopeV1` (`schemaVersion: 1`, `status: "success"` \| `"failure"`, optional `message`). **No** `skipped` flag on the envelope today. Thrown errors → **500**; Zod validation → **400**.            |
| **Diagnostics & Hermes UI** | **No** persisted run diagnostics resource in **agent-data-api-contract** and **no** Hermes dashboard page for content-generation runs (contrast with PRD FR5–FR6 targets).                                                                                                                                                                            |
| **Registry / schemas**      | Agent registers **`/schemas`** (Zod → JSON Schema) for **input** and **config** for Hermes forms; `agentId`: **`content-generation`**, `agentVersion`: **`1.0.0`**.                                                                                                                                                                                   |

**Remaining gaps motivating this PRD** (still accurate):

- Prompts and most knobs remain **code-deploy** changes except **API key** and **model** via Hermes config.
- Failures are primarily **logs** and HTTP status; there is no **first-class persisted diagnostics** surface for operators.
- Repeat runs can **regenerate and store again** without skip-if-fresh or provenance to explain which config run produced which row.

This PRD defines improvements so the agent is **globally configurable in Hermes**, **operationally observable** with persisted diagnostics and a **minimal Hermes UI**, and **auditable** via rich provenance on stored newsletters.

## Problem Statement

Newsletter quality and cost depend on model choice, prompts, and context limits, but operators cannot tune these safely without releases. When OpenAI or `agent-data-api` fails, diagnosing **whether the problem was LLM, validation, or persistence** requires digging through logs.

Operators cannot reliably answer:

- what configuration produced a given newsletter
- why a run skipped vs failed
- whether a repeat pipeline run **should** have called the LLM again

## Goals

- Expose **global** Hermes configuration for generation (model, sampling, prompts, output shape, context limits, retry policies) and **Hermes-managed API credentials** for OpenAI in production.
- Persist **structured run diagnostics** (success, skip, failure) with enough detail for admin triage without relying on logs alone.
- Ship a **minimal Hermes view** listing recent runs with filters (time range, ticker, outcome).
- Record **rich provenance** on persisted newsletters (model, config identity, token usage, agent version, config snapshot reference).
- Implement **skip-if-fresh** idempotency: avoid duplicate LLM work when a newsletter for the same ticker already exists within a defined window.
- Persist **OpenAI token usage** per successful generation for cost tracking.

## Non-Goals

- **Per-ticker or per-workspace** configuration overrides in v1 (global config only).
- **Email, Slack, or webhooks** for proactive alerting in v1 (diagnostics UI + logs only); phase 2 may add outbound notifications.
- Replacing the **delivery** agent or changing the **email HTML** pipeline beyond what stored `subject` / `content` already support.
- **A/B testing** or multiple concurrent prompt **profiles** in Hermes (single active global profile in v1).
- Building a **large** new observability product; the Hermes surface is **minimal** (list/detail of diagnostics).

## Users and Stakeholders

- **Hermes admins:** configure prompts, model, limits, retries; inspect failures and skips.
- **Agent operators:** monitor reliability, cost (tokens), and idempotency behavior.
- **Downstream delivery:** continues to consume stored newsletters; must behave predictably when **skip** prevents a new row (see coordination note below).
- **Platform engineers:** maintain `agent-data-api` contracts, agent runtime, and SDK.

## Resolved Product Decisions (v1)

| Topic               | Decision                                                                                                                                                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config scope        | **Global only** — one active configuration for all tickers.                                                                                                                                                                                                                                 |
| Secrets             | **Hermes-managed** — OpenAI credentials supplied via runtime config for normal production operation; env-based fallback allowed **only** for local development / explicit bootstrap (documented).                                                                                           |
| Config richness     | **Standard** — model, temperature, system + user prompt templates, configurable `topNews` count, per-source and total context limits, bounded **LLM retry** policy.                                                                                                                         |
| Observability       | **Persisted diagnostics** plus **minimal Hermes UI** (not logs-only).                                                                                                                                                                                                                       |
| Alerting            | **In-app / UI only** in v1 — no outbound notifications.                                                                                                                                                                                                                                     |
| Outcomes            | **Skipped** when no sources or when **skip-if-fresh** applies; **failed** after LLM retries exhausted or on non-retryable LLM errors; **failed** on persistence errors (with **distinct diagnostic `stage`**); **no `partial_success`** for v1 (if content is not stored, the step failed). |
| Persistence retries | **Limited retries** for **transient** `agent-data-api` errors (e.g. 5xx, timeouts); **no retries** for clear client/validation failures (4xx).                                                                                                                                              |
| Repeat runs         | **Skip if fresh** — if a newsletter already exists for `tickerId` within the configured freshness window, return **skipped** and **do not** call OpenAI.                                                                                                                                    |
| Provenance          | **Rich** — persist model, config version / prompt hash, token counts, agent version, and reference to a **config snapshot** (or equivalent immutable id).                                                                                                                                   |
| Token usage         | **Persist** prompt/completion/total tokens on the stored newsletter and/or aligned diagnostics record.                                                                                                                                                                                      |

**Note:** This table describes **target v1** product behavior. Until FR3–FR4 are implemented, **no sources** is surfaced as **`status: "failure"`** on the agent response (not a distinct **skipped** outcome). See **Implementation snapshot** and FR4.

## Functional Requirements

### FR1: Hermes Global Configuration Schema

- **Status (2026-03-22):** **Partial** — the agent already loads **Zod-validated** config on each invocation (`ContentGenerationConfigSchema`: `openaiApiKey`, optional `openaiModel`) and exposes **`GET /schemas`** (JSON Schema for Hermes). The richer groups below are **not** implemented yet.
- The `content-generation` agent must load an explicit **Zod-validated** config from the standard Hermes/runtime config path used by other agents (consistent with platform patterns).
- **Required conceptual groups:**
  - **OpenAI:** `apiKey` (secret), `baseUrl` (optional override), `model`, `temperature`, optional `maxTokens`, request `timeoutMs`.
  - **Prompts:** `systemPrompt` and `userPromptTemplate` (or equivalent) supporting documented placeholders (e.g. `{{sourceSummaries}}`, optional `{{tickerId}}`, `{{date}}`).
  - **Output shape:** `topNewsCount` (positive integer; replaces hardcoded “exactly 3” in code).
  - **Context limits:** `maxCharsPerSource`, `maxTotalContextChars` (or token-based budget if implemented — must be documented).
  - **LLM retries:** `maxAttempts`, `baseDelayMs`, `maxDelayMs`, jitter; **retry only** for retryable OpenAI errors (rate limit, 5xx, timeout) per classified mapping.
- Config must expose a **JSON Schema** (or equivalent) for Hermes forms via the same mechanism as other agents (`getConfigSchema`-style), with `agentId: "content-generation"`.
- **Invalid config** at runtime must fail fast with a **structured, actionable** error (and diagnostic record when applicable), not silent fallback to unsafe defaults.

### FR2: Hermes-Managed Credentials (Production)

- **Status (2026-03-22):** **Met in spirit for the agent process** — the worker sends the key in **`config.openaiApiKey`**; the agent env package does not define `OPENAI_API_KEY`. Formal **local-dev env fallback** and production guardrails (warnings) may still need documentation and Hermes UX polish.
- Production deployments must **not** require `OPENAI_API_KEY` in the agent environment for normal operation; the key must come from Hermes-managed config.
- Document **local development** workflow: env fallback or injected test config, with warnings if misused in production.

### FR3: Skip If Fresh (Idempotency)

- **Status (2026-03-22):** **Not implemented** — no pre-LLM newsletter existence check.
- Before calling OpenAI, the agent checks whether a newsletter already exists for `tickerId` within the configured **freshness window**.
- **Freshness window (v1):** `calendar_day` in a configurable **IANA timezone** (e.g. `Asia/Jakarta`), stored in global config as `freshnessTimezone`. The window boundaries use that timezone’s start/end of calendar day.
  - Rationale: aligns with how operators think about “today’s newsletter” and matches typical daily schedules without coupling to a specific pipeline cron string.
  - **Note:** Today, **source selection** for the GET uses a **UTC** “start of day” window in `getDataSourcesForTicker`; skip-if-fresh should be explicitly aligned (same or different rule) when implemented.
- If a qualifying row exists, the run returns **`success: false`, `skipped: true`** with a clear `message` (and persisted diagnostic) and **must not** invoke OpenAI. **Today’s** `@workspace/agent-runtime` envelope has only `status: "success" | "failure"` — implementing **skip** may require envelope or scheduler conventions updates (e.g. distinguish skip from hard failure).
- **Coordination with delivery:** Product/engineering must confirm that downstream steps behave correctly when no **new** row is written (e.g. delivery still sends the existing newsletter or skips according to product rules). Document the chosen behavior in implementation and dev-docs.

### FR4: Structured Outcomes and Error Taxonomy

- **Status (2026-03-22):** **Not implemented** — no persisted taxonomy; “no sources” returns **`success: false`** with a message and **HTTP 200** + `status: "failure"` (not classified as skip in the envelope).
- Classify errors for diagnostics (non-exhaustive; extend as needed):
  - `no_sources` → **skipped** (**target**; **today** the agent returns **failure** with message “No data sources…” — not a distinct skip outcome).
  - `skipped_fresh_newsletter_exists` → **skipped** (new).
  - `openai_retry_exhausted`, `openai_non_retryable`, `openai_invalid_response`, `validation_failed` → **failed** after handling.
  - `persist_transient`, `persist_client_error` → **failed**; distinguish **retryable** for transient persist errors.
- **Target** mapping to HTTP responses: align with **evolving** `@workspace/agent-runtime` / Hermes scheduler expectations. **Today:** agents return **200** + envelope for handled outcomes; **throws** → 500; **Zod** errors → 400. The PRD’s **4xx + `skipped: true`** pattern is a **design target**, not current behavior.
- **No `partial_success` in v1:** if generated text is not successfully persisted, the run **fails**.

### FR5: Persisted Diagnostics

- **Status (2026-03-22):** **Not implemented** — no diagnostic resource in `@workspace/agent-data-api-contract`.
- Each invocation must create or update a **persisted diagnostic record** accessible to Hermes (exact storage: `agent-data-api` additive contract, Hermes DB, or both — implementation follows platform standard; see **API and Contract Considerations**).
- Minimum fields:
  - `agentId` (`content-generation`), `agentVersion`
  - `tickerId`
  - `outcome` (`success`, `skipped`, `failed`)
  - `stage` (when applicable: `precheck`, `llm`, `validate`, `persist`)
  - `errorCode` / `errorCategory` (when failed)
  - `message` (sanitized; no secrets)
  - `createdAt`, `durationMs` (optional)
  - correlation: pipeline run id / request id when available from Hermes caller
- **Logs** remain required but are **supplemental** to persisted diagnostics.

### FR6: Minimal Hermes Diagnostics UI

- **Status (2026-03-22):** **Not implemented** — no dedicated diagnostics UI for this agent in `apps/hermes/dashboard`.
- Hermes must expose a **minimal** page (or embedded panel) for `content-generation`:
  - table of recent diagnostic rows (sortable by time, default newest first)
  - filters: **time range**, **ticker**, **outcome**
  - row expands or detail view: full message, error code, stage, linked `newsletterId` if success
- V1 scope is **read-only** inspection (no “replay run” button required).

### FR7: Rich Provenance on Newsletter Records

- **Status (2026-03-22):** **Not implemented** — newsletter rows and API body lack model, tokens, and config snapshot fields.
- On successful `contentGeneration.create`, persist alongside subject/content/description:
  - `model` used
  - `agentVersion`
  - `configVersion` and/or **`promptHash`** (hash of effective system+user prompt after substitution)
  - **`configSnapshotId`** referencing the immutable Hermes config snapshot (or hash of full config JSON)
  - **token usage:** `promptTokens`, `completionTokens`, `totalTokens` from OpenAI response
- If schema migration is required, follow Prisma migration practices and additive API contract updates.

### FR8: LLM and Output Validation

- **Status (2026-03-22):** **Partial** — `parseNewsletterJson` + Zod (`parse-newsletter-json.ts`) validates structure; **no** configurable context truncation before the LLM call (full source text is concatenated into the user message).
- Keep **strict validation** of OpenAI JSON output (existing `parseNewsletterJson` path); extend schemas if `topNewsCount` is configurable.
- Truncate or reject source text per `maxCharsPerSource` / `maxTotalContextChars` **before** the LLM call; order of truncation must be deterministic (documented).

### FR9: Backward Compatibility

- Pipeline input **`{ tickerId }`** remains valid; optional fields may be added later (e.g. `forceRegenerate`) **out of scope for v1** unless needed to bypass skip-if-fresh for support — if added, must default to current behavior.

## Proposed Config Shape (v1)

**Note:** Full shape below is a **design target**. As of 2026-03-22, only **`openaiApiKey`** (required) and **`openaiModel`** (optional) exist in `ContentGenerationConfigSchema`.

```json
{
  "openai": {
    "apiKey": "<secret>",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini",
    "temperature": 0.4,
    "maxTokens": 4096,
    "timeoutMs": 120000
  },
  "prompts": {
    "systemPrompt": "You are a newsletter writer...",
    "userPromptTemplate": "Create a newsletter from these data sources...\n\n{{sourceSummaries}}"
  },
  "output": {
    "topNewsCount": 3
  },
  "context": {
    "maxCharsPerSource": 8000,
    "maxTotalContextChars": 100000
  },
  "llmRetry": {
    "maxAttempts": 3,
    "baseDelayMs": 500,
    "maxDelayMs": 8000,
    "jitter": true
  },
  "freshness": {
    "strategy": "calendar_day",
    "timezone": "Asia/Jakarta"
  },
  "persistRetry": {
    "maxAttempts": 2,
    "baseDelayMs": 200,
    "maxDelayMs": 2000
  }
}
```

## API and Contract Considerations

- **Current contract** — `packages/shared/agent-data-api-contract/src/content-generation.ts`: `GET` returns `dataSources[]`; `POST` accepts `subject`, optional `description`, `content`, `tickerId` (`postContentGenerationBodySchema`). Handlers live under `apps/mediapulse/agent-data-api/src/routes/content-generation.ts` and `services/content-generation.ts`.
- **Newsletter create payload** must be extended **additively** for provenance and token fields (`packages/agent-data-api-contract`, handlers, client SDK, tests, dev-docs).
- **Diagnostics:** introduce additive resources (e.g. `content_generation_run` or generalized `agent_run_diagnostic`) following the **agent-data-api** skill/manifest workflow. There is **no** data-collection diagnostics pattern in the shared contract yet to mirror — greenfield alignment when implemented.
- All contract changes propagate to **SDK**, **tests**, and **docs**.

## Observability

- **Today:** structured logs include data sources, config (avoid logging secrets — config object may contain `openaiApiKey`; verify redaction policy before enabling verbose config logging in production), newsletter store success, and errors on persist.
- **Target:** structured logs at: precheck (skip-if-fresh), LLM request start/end, validation failure, persist start/end, final outcome.
- Never log API keys or raw secrets.
- **Target:** Include `tickerId`, `configSnapshotId` / `configVersion`, `newsletterId` on success.

## Acceptance Criteria

**Definition of v1 done** (not all met in the codebase as of 2026-03-22; see **Implementation snapshot**):

- Admin can set **global** content-generation config in Hermes including **OpenAI credentials** without redeploying the agent for routine changes. _(**Partial:** key + model via config today; full prompt/limit/retry surface still code-deploy.)_
- Agent uses **Hermes config** for prompts, model, `topNewsCount`, context limits, and retries; invalid config is rejected with clear errors.
- **Skip-if-fresh** prevents duplicate LLM calls when a newsletter for the same ticker **calendar day** (per configured timezone) already exists.
- Failures and skips produce **persisted diagnostics** inspectable in **Hermes UI**; logs are secondary.
- Successful newsletters store **provenance** and **token usage** per FR7.
- LLM failures are **retried** per policy; persist transient failures are **retried** within bounds; stages are distinguishable in diagnostics.

## Rollout Plan

1. **Contract and storage:** extend newsletter and add diagnostics persistence; migrate DB if needed.
2. **Agent:** config schema, Hermes/runtime wiring, skip-if-fresh, retries, provenance on create.
3. **Hermes:** config UI + diagnostics page.
4. **Docs:** dev-docs for config keys, freshness behavior, and operational runbook.

## Phase 2 (Out of Scope for This PRD)

- Webhooks or email alerts on repeated failures.
- Per-ticker or workspace overrides.
- Multiple named prompt profiles or A/B tests.
- `forceRegenerate` or support-only bypass of skip-if-fresh (optional small follow-up).

## Risks and Mitigations

- **Risk:** Skip-if-fresh confuses operators (“pipeline green but no new email”).
  - **Mitigation:** clear skipped reason in diagnostics; document delivery behavior; optional phase-2 `forceRegenerate`.
- **Risk:** Misconfigured prompts break JSON output.
  - **Mitigation:** strong validation, retry only where appropriate, classify `validation_failed` in diagnostics.
- **Risk:** Secret leakage in diagnostics or logs.
  - **Mitigation:** redaction rules; never persist raw keys.
