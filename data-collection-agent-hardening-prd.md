# Data Collection Agent Hardening PRD

## Document Control

- Product: MediaPulse
- Feature: Data Collection Agent Hardening
- Owner: Platform and Agents
- Status: Draft (requirements largely **not yet implemented** — see [Current implementation snapshot](#current-implementation-snapshot))
- Last Updated: 2026-03-22

## Current implementation snapshot

This section reflects the repository as of the last update above. Use it to separate “already landed” from “still planned.”

| Area                        | Current state                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hermes config schema**    | `apps/mediapulse/agents/data-collection/src/utilities/config-schema.ts` defines Zod schemas for `webSearch` and `webFetch` (`baseUrl`, `authentication`, `rateLimit`). The agent is registered with `createAgentApp` from `@workspace/agent-runtime`, which exposes **GET `/schemas`** (input + config JSON Schema) for Hermes.         |
| **Config used at runtime**  | **No.** The `run` handler in `src/index.ts` binds `config` as `_config` and does not pass it to `performWebSearch` / `performWebFetch`. Provider URLs and auth still come from **hardcoded endpoints** in `web-search.ts` / `web-fetch.ts` and **`SERPER_API_KEY` / `JINA_API_KEY`** from `@mediapulse/env/agents-data-collection`.     |
| **Env vs config**           | Production path still **requires** `JINA_API_KEY` and `SERPER_API_KEY` at startup; behavior matches the pre-hardening “env keys” model.                                                                                                                                                                                                 |
| **Response validation**     | Serper and Jina JSON are validated with Zod (`serperResponseSchema`, `webFetchResponseSchema`), but handlers use **`.parse()`** (throws on failure), not **`safeParse()`** with classification. There is no separate “semantic” quality layer; empty `link` / missing organic results can still yield **empty URLs** pushed downstream. |
| **Per-item isolation**      | **No.** A single failed HTTP request or parse error fails the whole invocation; no `partial_success`, no per-item error records.                                                                                                                                                                                                        |
| **Rate limiting**           | **`rateLimit` in config is unused.** Pacing is **modulo-based** `sleep(1000)` every two items (`index > 0 && index % 2 === 0`) in both `performWebSearch` and `performWebFetch`.                                                                                                                                                        |
| **Retries / timeouts**      | **Not implemented** as configurable policy; default `got` behavior only.                                                                                                                                                                                                                                                                |
| **Run summary / metrics**   | Handler returns **`{ success: true }`** only. No structured counters, validation stats, or retry counts.                                                                                                                                                                                                                                |
| **Diagnostics persistence** | **Not present.** `agent-data-api` exposes only existing `dataCollection` GET/POST (`packages/shared/agent-data-api-contract/src/data-collection.ts`). No `data_collection_run` / `data_collection_failure` resources.                                                                                                                   |
| **Metadata on sources**     | `src/utilities/data-sources.ts` defines `toDataSources()` with `metadata` (`fetchedAt`, `sourceType`, optional `searchQueryText`), but **`src/index.ts` does not use it** — it maps via `toDataCollectionInputs()` without that metadata.                                                                                               |
| **Invocation body**         | Agent validates `tickerId` + optional `timeWindow` in `index.ts` (`z.string()` for `tickerId`). Shared/agent-data-api contract types use **`tickerId` as UUID** for API queries and POST bodies; alignment is a small consistency item when hardening.                                                                                  |

**Bottom line:** the **shape** of Hermes-ready provider config exists, but **hardening goals (FR1–FR6) are still ahead**: wiring `config` into HTTP clients, replacing stagger with limiters, `safeParse` + error taxonomy, partial failures, retries, run summaries, and additive diagnostics APIs.

---

## Background

The `data-collection` agent fetches search queries from `agent-data-api`, performs web search through Serper, fetches article content through Jina, and stores collected sources back to `agent-data-api`.

The current implementation works for happy-path collection but has operational gaps:

- provider keys are read from **environment** for execution; **Hermes `config` is not applied** despite an existing config schema
- third-party responses are zod-validated with **strict `.parse()`**, without **layered** validation or **non-throwing** classification
- one provider failure can fail an entire run
- admin users have **no** persisted, structured visibility into provider-level failures
- request pacing is **modulo-based sleep**, and **`rateLimit` from config is unused**

This PRD defines improvements to make the agent configurable, reliable, and observable in production.

## Problem Statement

Data collection depends on external providers and unpredictable web content, but current control and diagnostics are too limited for admin operations:

- admins **cannot** rotate provider credentials via Hermes config for this agent until **`config` is wired** and env keys are demoted to optional fallback
- malformed or low-quality provider responses are only partially controlled; **empty URLs** can still flow without a dedicated semantic validation step
- transient provider failures are **not** surfaced in a structured way for quick diagnosis
- rate limiting behavior is **implicit** in code and **not** aligned to config

As a result, operators cannot quickly answer:

- which queries or URLs failed and why
- whether failures are retryable or provider-side
- whether data quality dropped due to invalid upstream payloads

## Goals

- Make provider settings and credentials configurable through Hermes agent **`config`** and use them in the run path.
- Enforce **strict, classifiable** validation for all third-party data before use (including `safeParse` and semantic checks where needed).
- Improve run resilience with partial-failure handling and deterministic outcomes.
- Provide admin-visible failure details and run-level diagnostics (persisted where feasible).
- Replace hardcoded stagger pacing with **config-driven** rate-limit behavior.

## Non-Goals

- Replacing Serper or Jina providers in v1.
- Building a brand-new observability UI from scratch in v1.
- Introducing per-ticker provider credentials in v1.
- Solving all deduplication and ranking quality improvements beyond this hardening scope.

## Users and Stakeholders

- Hermes admins: configure providers and investigate failures.
- Agent operators: monitor reliability and throughput.
- Data consumers (analysis and content-generation agents): rely on stable, valid sources.
- Platform engineers: maintain runtime and API contracts.

## Functional Requirements

Implementation status: **planned** unless marked **[partial]** in the title.

### FR1: Hermes-Driven Provider Configuration

- The `data-collection` agent must consume provider configuration from runtime `config`, not env keys for normal operation.
- Config for both `webSearch` and `webFetch` must include:
  - `baseUrl`
  - `authentication` (`type`, key value, and optional header name)
  - `rateLimit` (`requests`, `perSeconds`)
  - optional timeout/retry parameters _(not in current schema — extend `config-schema.ts`)_
- Agent startup may still support safe local defaults via env only when explicitly configured as fallback behavior.
- Missing required config should return structured failure with actionable message.

**Current:** Schema exists **[partial]**; runtime still uses env + hardcoded URLs.

### FR2: Strict Third-Party Response Validation

- All responses from Serper and Jina must be validated with zod before mapping to internal entities.
- Validation must use two layers:
  - base provider schema validation (`safeParse`)
  - provider-specific semantic validation for data quality
- Validation must distinguish:
  - transport error (network/timeout)
  - non-2xx provider response
  - schema validation failure
  - semantically invalid record (for example, empty URL/content when required)
- Invalid provider payloads must not be persisted as collected data sources.

**Current:** Single-layer `.parse()` **[partial]**; no classification; weak records may still be emitted.

### FR3: Per-Item Error Isolation

- Failures for one query or URL must not fail the whole run by default.
- The run should continue for remaining items and produce:
  - successful collected items
  - failed items with normalized error classification
- Run status rules:
  - `failed` when `successfulSources === 0` and `runPolicy.failOnZeroSuccess = true`
  - `partial_success` when both successes and failures exist
  - `success` when no item-level failures occur
- Configurable guardrail:
  - `runPolicy.minSuccessfulSources` (default `1`)
  - `runPolicy.failOnZeroSuccess` (default `true`)

**Current:** Not implemented.

### FR4: Admin-Visible Failure Diagnostics

- Provider failure diagnostics must be surfaced in an admin-consumable form.
- Minimum captured fields per failure:
  - stage (`web-search` or `web-fetch`)
  - provider (`serper` or `jina`)
  - query or URL context
  - status code (if available)
  - error class/code
  - sanitized error message
  - timestamp and ticker context
- Diagnostics must be available through existing platform surfaces (logs and/or persisted records via agent-data-api contract extension).
- V1 must include a minimal Hermes diagnostics view backed by persisted diagnostics.
- Logs remain required as supplemental signal but are not the only operator surface.

**Current:** Structured logging exists on the HTTP app; no persisted diagnostics API.

### FR5: Configurable Rate Limiting and Retries

- Replace modulo-based sleep staggering with a configurable limiter strategy derived from config.
- Limiter behavior must enforce provider limits predictably.
- Retry policy must be explicit and configurable, with bounded attempts and jittered backoff for retryable failures (429/5xx/timeouts).
- Non-retryable failures should fail fast per item and be recorded.

**Current:** Modulo sleep; config `rateLimit` unused.

### FR6: Structured Run Summary

- Each run should emit and return summary metrics:
  - total queries processed
  - total URLs fetched
  - successes and failures by stage/provider
  - validation failure counts
  - retry counts
- Summary should be logged in structured form and, where feasible, persisted for admin inspection.

**Current:** Returns `{ success: true }` only.

### FR7: Backward Compatibility

- Existing pipeline invocation contract (`input.tickerId`, optional `timeWindow`) remains unchanged.
- Existing downstream data schema remains valid for successful records.
- Any new diagnostics persistence should be additive and not break current consumers.

## Proposed Config Shape (v1)

The live Zod schema today covers only `webSearch` + `webFetch` (no `timeoutMs`, `retry`, or `runPolicy`). The target shape below is the full v1 proposal:

```json
{
  "webSearch": {
    "baseUrl": "https://google.serper.dev/search",
    "authentication": {
      "type": "bearer",
      "apiKey": "<secret>",
      "headerName": "X-API-KEY"
    },
    "rateLimit": { "requests": 2, "perSeconds": 1 },
    "timeoutMs": 10000,
    "retry": { "maxAttempts": 3, "baseDelayMs": 300, "maxDelayMs": 3000 }
  },
  "webFetch": {
    "baseUrl": "https://r.jina.ai/",
    "authentication": {
      "type": "bearer",
      "apiKey": "<secret>",
      "headerName": "Authorization"
    },
    "rateLimit": { "requests": 2, "perSeconds": 1 },
    "timeoutMs": 15000,
    "retry": { "maxAttempts": 2, "baseDelayMs": 500, "maxDelayMs": 4000 }
  },
  "runPolicy": {
    "minSuccessfulSources": 1,
    "failOnZeroSuccess": true
  }
}
```

## Validation and Data Quality Requirements

- URL must be non-empty and valid URL format before persistence.
- Content must pass minimum quality checks (non-empty after trim; optional min-length threshold configurable).
- Title fallback is allowed only when URL and content are valid.
- All schema parsing should prefer `safeParse` for controlled error handling and classification.

## Error Model

Standardized error categories:

- `network_error`
- `timeout_error`
- `provider_http_error`
- `provider_schema_error`
- `provider_data_invalid`
- `internal_processing_error`

Each captured error entry should include `retryable: boolean`.

## API and Contract Considerations

V1 decision:

- Introduce additive run/failure diagnostics resources in `agent-data-api` rather than relying only on per-source metadata.
- Keep optional per-source metadata minimal (for quick row-level context), but treat dedicated diagnostics resources as source of truth for failed items and run summaries.

Recommended diagnostics entities for contract and storage:

- `data_collection_run`
  - `id`
  - `tickerId`
  - `startedAt`
  - `completedAt`
  - `status` (`success`, `partial_success`, `failed`)
  - counters (`queriesTotal`, `urlsTotal`, `searchSuccess`, `searchFailed`, `fetchSuccess`, `fetchFailed`, `retryCount`)
- `data_collection_failure`
  - `id`
  - `runId`
  - `tickerId`
  - `stage`
  - `provider`
  - `searchQueryId` (optional)
  - `url` (optional)
  - `errorCategory`
  - `retryable`
  - `httpStatus` (optional)
  - `message`
  - `createdAt`

All contract changes must follow manifest-first workflow in `@workspace/agent-data-api-contract` and be reflected in API, client SDK, agent consumers, tests, and docs.

## Observability

- Use structured logs at key points:
  - run started
  - search request attempted/completed/failed
  - fetch request attempted/completed/failed
  - run completed summary
- Ensure secrets are never logged.
- Include correlation context (`tickerId`, `searchQueryId`, provider stage).

## Acceptance Criteria

- Admin can configure Serper and Jina credentials via Hermes config for the agent **and the run uses that config for URLs and auth.**
- Agent no longer depends on hardcoded `SERPER_API_KEY` and `JINA_API_KEY` for normal production flow (env may remain optional fallback only).
- Third-party responses are strictly zod-validated with **`safeParse`** (or equivalent) and semantic checks before persistence; invalid rows are skipped or flagged per FR2.
- One failed fetch/search item no longer aborts all remaining items (per FR3).
- Admin can inspect clear failure diagnostics through persisted run/failure records (with structured logs as supplemental signal).
- Rate limiting is config-driven; **modulo-based sleep removed** from `web-search.ts` / `web-fetch.ts`.
- Run outputs include summary counts for successes and failures (and Hermes envelope reflects status where applicable).

## Rollout Plan

### Phase 1: Agent Hardening

- Wire runtime `config` into `performWebSearch` / `performWebFetch` (base URL, headers, auth from config); extend schema with `timeoutMs` / `retry` / `runPolicy` as needed.
- Replace `.parse()` with `safeParse` + error classification; add semantic validation (e.g. reject empty URLs).
- Implement per-item error isolation and configurable limiter + retry strategy.
- Emit structured run summaries (return payload + logs).

### Phase 2: Diagnostics Persistence

- Add additive contract/API support for dedicated run and failure diagnostics resources.
- Expose diagnostics in Hermes-friendly surface.

### Phase 3: Tuning

- Tune retry and limiter defaults from production behavior.
- Refine quality thresholds and error taxonomy based on observed failures.
- Add light provider health trends in Hermes (counts by provider/stage/error category).

## Risks and Mitigations

- Risk: Config misconfiguration causes higher failure rates.
  - Mitigation: strict config validation, safe defaults, clear startup/runtime errors.
- Risk: Too-strict validation drops useful content.
  - Mitigation: start with conservative required fields and monitor drop rates.
- Risk: Increased complexity in failure handling.
  - Mitigation: keep standardized error model and focused unit tests around each failure class.
