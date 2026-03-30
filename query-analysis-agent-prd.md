# Query Analysis Agent PRD

## Document Control

- Product: MediaPulse
- Feature: Query Analysis Agent
- Owner: Platform and Agents
- Status: Draft — **not yet implemented end-to-end** (see [Implementation status vs repository](#implementation-status-vs-repository))
- Last Updated: 2026-03-22

## Background

MediaPulse runs scheduled agents to collect, analyze, and deliver ticker-related news. The data-collection agent already consumes search queries and uses them to fetch source articles. A new query-analysis agent is needed to generate better search queries daily using ticker context and knowledge-graph signals.

The generated queries must be versioned, configurable by admin users in Hermes, and aligned with this priority order:

1. Latest breaking news
2. Knowledge-graph relation changes
3. Fundamental analysis

## Implementation status vs repository

This PRD remains the **target design**. As of the Mediapulse monorepo state reviewed for this document, the following applies:

| Area                            | In repo today                                                                                                                                                                                    | Gap vs this PRD                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Agent package**               | No `apps/mediapulse/agents/query-analysis` app                                                                                                                                                   | Full agent implementation (deterministic + LLM, persistence) still to build                                                             |
| **Orchestration**               | Hermes seed scripts reference `query-analysis@1.0.0` and a daily pipeline                                                                                                                        | Agent must be deployed and registered like other agents                                                                                 |
| **agent-data-api**              | `contentGeneration`, `dataCollection`, `delivery` in manifest and routes                                                                                                                         | **`queryAnalysis` is not** in `agentDataApiManifest`; no `/api/v1/query-analysis` handlers                                              |
| **Shared contract**             | `packages/shared/agent-data-api-contract/src/query-analysis.ts` defines minimal GET/POST Zod schemas                                                                                             | Schemas are **not** registered in the manifest; **no** `@workspace/agent-data-api-client` methods                                       |
| **GET response shape**          | Contract: ticker, `topEntities`, `recentThemes` only                                                                                                                                             | PRD also wants global config snapshot, optional KG relation deltas — extend contract when implementing                                  |
| **POST response shape**         | Contract: `{ created: number }` only                                                                                                                                                             | PRD wants set id, active set id, lineage — extend contract                                                                              |
| **Database**                    | `SearchQuery`: `id`, `text`, `tickerId`, timestamps                                                                                                                                              | No `search_query_set`, no `source` / `intent` / `rank`, no per-ticker active set                                                        |
| **Data-collection consumer**    | `GET .../data-collection?tickerId=...` returns **all** `SearchQuery` rows for the ticker (optional `createdAt` window)                                                                           | After versioning: either filter to **active set** in this GET or add query fields; otherwise inactive/historical rows could be searched |
| **Hermes Search Queries table** | Mediapulse domain manifest: **4** columns (`tickerSymbol`, `tickerName`, `text`, `createdAt`); delete-only; see [Hermes dashboard: Search Queries table](#hermes-dashboard-search-queries-table) | Extend **list JSON + `table-v1` manifest** with set lineage, intent, and operational fields below                                       |

**Conclusion:** The feature is **implementable** as a greenfield build against this PRD, but **nothing in the checklist above is complete** beyond documentation, pipeline seed entries, and standalone Zod types. Follow the monorepo agent-data-api workflow (contract → `agentDataApiManifest` → API routes → SDK → agents → `dev-docs`) when implementation starts.

## Problem Statement

Current query generation is static and does not systematically adapt to:

- ticker-specific entity context
- changing entity relations in the knowledge graph
- day-to-day shifts in news cycles
- admin-level strategy preferences

This leads to lower relevance and coverage in collected articles.

## Goals

- Generate high-quality, ticker-specific query sets once per day.
- Store queries as versioned sets, preserving historical lineage.
- Make query strategy globally configurable by admins in Hermes.
- Combine deterministic baseline queries with LLM-added or optimized queries.
- Provide query outputs that are directly consumable by data-collection.

## Non-Goals

- Per-ticker custom configuration in v1.
- Real-time query regeneration throughout the day.
- Building a separate UI for manual query editing in v1.
- Replacing data-collection search providers in this scope.

## Users and Stakeholders

- Hermes admins: configure global query generation behavior.
- Query-analysis agent: creates and stores daily query sets.
- Data-collection agent: consumes active query set to gather articles.
- Product and ML owners: monitor quality and iteration outcomes.

## Functional Requirements

### FR1: Daily Query Generation

- The query-analysis agent must run once per day for each subscribed ticker.
- Scheduler integration uses existing Hermes pipeline and schedule infrastructure.

### FR2: Versioned Query Sets

- Each generation must create a new query set version per ticker.
- Each set stores metadata and strategy snapshot used for generation.
- Exactly one query set is marked active per ticker at a time.
- Historical sets remain queryable for traceability and analysis.
- **Orchestration lineage:** When the run is triggered by the Hermes worker, the persisted set must record the **Hermes agent job id** (see `agent_job_id` under Data Model) so operators can relate a query set to a **schedule execution** and **invocation** in the orchestration database and Hermes dashboard (join path: `agent_job_execution.job_id` → `schedule_execution` → `schedule`). Manual or test runs may leave this null.

### FR3: Hybrid Generation Strategy

- Query creation uses two phases:
  - Deterministic baseline generation
  - LLM addition or optimization
- Deterministic baseline guarantees a minimum set of robust, predictable queries.
- LLM output expands and improves breadth while respecting guardrails.

### FR4: Strategy Priority Enforcement

- Output query mix should follow this ranking priority:
  1. Breaking news intent
  2. KG relation-change intent
  3. Fundamental analysis intent
- Priority must influence prompt construction and final ranking.

### FR5: Global Admin Config in Hermes

- Admins can update global settings without code changes.
- Config is global (not per ticker) in v1.
- Config must include:
  - target query count per set
  - allowed languages list
  - strategy weights or priority controls
  - minimum deterministic query count

Implementation note: add typed env keys under `@mediapulse/env` (e.g. agent-specific export) and `env.example`; they do **not** exist in the monorepo yet.

### FR6: Data-Collection Compatibility

- Data-collection must retrieve queries for a ticker via **agent-data-api** (today: `dataCollection.get`).
- **Current behavior:** returns every `SearchQuery` for the ticker. **Target behavior after this feature:** return only queries belonging to the **active** set (or equivalent filtering), so data-collection needs **no** change to HTTP client shape beyond possibly relying on stricter server filtering once sets exist.
- Prefer extending the existing data-collection GET handler (or its backing query) to respect active-set semantics rather than introducing a second client call from data-collection to query-analysis for the same data.

### FR7: Validation and Safety

- Query text must be trimmed, non-empty, and deduplicated.
- Invalid or low-signal queries must be filtered.
- If LLM generation fails, deterministic baseline still produces a usable set.

## Deterministic Baseline Definition

Deterministic baseline means a fixed-rule query generator, not model-generated text. For the same ticker input and config, baseline outputs are predictable and reproducible.

Example baseline templates:

- `{symbol} latest news`
- `{name} earnings guidance`
- `{name} regulatory update`
- `{name} partnership announcement`

Purpose:

- Guarantees minimum query coverage.
- Provides safe fallback when LLM fails.
- Improves debugging and operational reliability.

## Data Model Requirements

Add a versioned query set model around current `search_query` records.

### Proposed entities

- `search_query_set`
  - `id`
  - `ticker_id`
  - `generated_at`
  - `is_active`
  - **`strategy_snapshot` (JSON)** — Immutable copy of the **inputs and settings that governed this run**, stored at persist time (e.g. global admin config as of `generated_at`, weights, target counts, language allowlist, prompt/guardrail versions). Answers “why did this set look like this?” without relying on **current** Hermes/env config, which may have changed since generation. Matches the “set-level strategy snapshot” sent on query-analysis POST (persisted onto the new row). Make sure not to include any secrets or sensitive information.
  - **`generation_source` (string)** — Stable identifier for **which generator pipeline or implementation version** produced the set (e.g. `hybrid_v1` = deterministic baseline + LLM per FR3). For analytics, filtering, and safe rollout when templates or hybrid logic change. Not the same as per-query `source` (`deterministic` vs `llm` on each `search_query` row).
  - **`agent_job_id` (string, nullable)** — Hermes **`AgentJobExecution.jobId`** for this invocation. The worker sends it on every scheduled agent POST as the **`X-Job-Id`** HTTP header (see `packages/hermes/scheduler/src/invoke-agent.ts`). Persist it on the set (or pass it on the query-analysis POST body when the API persists on behalf of the agent) so Mediapulse data joins orchestration: one job row links to one `schedule_execution_id`, which ties to that **schedule’s** run (`execution_time`, pipeline steps, invocations UI). Not the same header as `X-Execution-Id` (per-enqueue id); prefer **`X-Job-Id`** for DB joins. Null for runs without Hermes (local dev, tests, manual API calls) if no id is available.
  - `created_at`

- `search_query` (existing, extended)
  - `id`
  - `set_id` (foreign key)
  - `text`
  - `source` (`deterministic` or `llm`)
  - `intent` (`breaking`, `kg_change`, `fundamental`)
  - `rank`
  - `ticker_id` (keep for compatibility if needed)
  - timestamps

### Constraints

- One active set per ticker (enforced by app logic and/or DB constraint strategy).
- Query uniqueness within set on normalized text.

## API and Contract Requirements

Use manifest-driven agent-data-api flow (see `@workspace/agent-data-api-contract` and `agentDataApiManifest`).

### Query-analysis GET

Returns generation context for a ticker:

- ticker info (`id`, `symbol`, `name`, metadata)
- top entities with relevance weights
- recent themes
- optional recent relation deltas for KG-change intent (**Phase 2** enrichment)
- global query-analysis config snapshot (**to be added** to contract when env keys exist)

### Query-analysis POST

Persists a new versioned query set:

- ticker id
- generated queries and metadata
- set-level strategy snapshot (becomes `search_query_set.strategy_snapshot` on the created row; see **`strategy_snapshot`** under Data Model)
- optional **`agent_job_id`** (becomes `search_query_set.agent_job_id`; typically from the agent’s inbound **`X-Job-Id`**; see FR2)
- activation directive (new set becomes active)

Response:

- created query count
- created set id
- active set id

**Contract alignment:** replace or extend the current minimal `query-analysis.ts` schemas when wiring the resource into the manifest so request/response match the above.

## Agent Behavior

### Inputs

- `tickerId`
- **Hermes invocation context** (when scheduled): read **`X-Job-Id`** from the inbound request and forward it through to persistence as **`agent_job_id`** so the set links to `agent_job_execution` / `schedule_execution`.

### Steps

1. Fetch query-analysis context from agent-data-api.
2. Build deterministic baseline queries.
3. Run LLM to add or optimize candidate queries.
4. Merge, normalize, dedupe, and score candidates.
5. Enforce configured size and intent mix priorities.
6. Persist as a new query set version and activate it, including **`agent_job_id`** when present.
7. Emit structured logs and run metadata (include **`agent_job_id`** / job id in logs when present for correlation).

### Ranking logic

- Weighted score based on:
  - intent priority
  - ticker/entity specificity
  - novelty vs recent sets
  - language appropriateness

## Hermes Admin Configuration

Global config keys (initial proposal; **add to `@mediapulse/env` when the agent exists**):

- `QUERY_ANALYSIS_QUERY_COUNT`
- `QUERY_ANALYSIS_ALLOWED_LANGUAGES` (JSON string array)
- `QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT`
- `QUERY_ANALYSIS_WEIGHT_BREAKING`
- `QUERY_ANALYSIS_WEIGHT_KG_CHANGE`
- `QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL`
- `QUERY_ANALYSIS_MODEL`
- `QUERY_ANALYSIS_MAX_TOKENS`
- `OPENAI_API_KEY` (used for LLM generation)
- `OPENAI_MODEL` (used for LLM generation)

Admin UX can initially use existing Hermes variable management pages.

## Hermes dashboard: Search Queries table

The Mediapulse domain API already registers a **Hermes `table-v1`** page for search queries (`searchQueriesDashboardPage` in `apps/mediapulse/domain-api/src/resources/search-queries/dashboard-page.ts`). It is **delete-only** (no create/update rows in v1); the goal is to give admins enough **read-only signal** to audit what the query-analysis agent produced and how it relates to schedules and active collection.

### Current manifest (repository)

| Column key     | Label        | `table-v1` type |
| -------------- | ------------ | --------------- |
| `tickerSymbol` | Ticker       | text            |
| `tickerName`   | Ticker Name  | text            |
| `text`         | Search Query | text            |
| `createdAt`    | Created      | date-time       |

Searchable today: `tickerName`, `tickerSymbol`, `text`. Sortable today: `createdAt` only.

The list mapper (`list-mapper.ts`) also returns `id` and `updatedAt`; they are not exposed as columns yet.

### Target columns (admin observability)

After `search_query_set` and extended `search_query` exist, **extend the list endpoint and manifest** so each row shows per-query and set-level context. Hermes `table-v1` supports column types **`text`** and **`date-time`** only; use **text** for enums and booleans (human-readable labels, e.g. `Active` / `Historical`, `Deterministic` / `LLM`).

| Column key (proposal) | Label (proposal)    | Type      | Source / purpose                                                                                                                                                            |
| --------------------- | ------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tickerSymbol`        | Ticker              | text      | Unchanged.                                                                                                                                                                  |
| `tickerName`          | Ticker Name         | text      | Unchanged.                                                                                                                                                                  |
| `text`                | Search Query        | text      | Unchanged.                                                                                                                                                                  |
| `activeSet`           | Active set          | text      | Whether this row’s **query set** is the **active** set for the ticker (`Yes` / `No`). Lets admins see historical rows without mistaking them for what data-collection uses. |
| `intent`              | Intent              | text      | `breaking`, `kg_change`, or `fundamental` (maps FR4 priority mix).                                                                                                          |
| `rank`                | Rank                | text      | Order within the set (numeric rank as string is fine for `table-v1`).                                                                                                       |
| `source`              | Source              | text      | `deterministic` vs `llm` (FR3).                                                                                                                                             |
| `setGeneratedAt`      | Set generated       | date-time | `search_query_set.generated_at` — when this version was produced.                                                                                                           |
| `generationPipeline`  | Generation pipeline | text      | `search_query_set.generation_source` (e.g. `hybrid_v1`) — which generator produced the set.                                                                                 |
| `querySetId`          | Query set id        | text      | `search_query_set.id` — stable handle for support and cross-referencing.                                                                                                    |
| `agentJobId`          | Hermes job id       | text      | `search_query_set.agent_job_id` when present; empty when null — links to schedule/job execution in Hermes (see FR2).                                                        |
| `createdAt`           | Created             | date-time | Unchanged (row-level).                                                                                                                                                      |
| `updatedAt`           | Updated             | date-time | From list mapper; surfaces last touch if relevant.                                                                                                                          |

**Search / sort (target):** Expand **`searchableFields`** to include at least `intent`, `source`, `querySetId`, and `agentJobId` (when non-empty). Expand **`sortableFields`** to include `setGeneratedAt`, `rank` (numeric ordering if the table layer allows), and `activeSet` if feasible; otherwise document client-side limitations.

**Implementation note:** Requires joining `search_query` → `search_query_set` in the list query and extending `ListItem` + `mapRowToListItem` accordingly. Keep labels and keys aligned with this table when implementing.

## Scheduling and Pipeline

- Keep `Query Analysis` pipeline as daily schedule.
- Ensure run time precedes daily data-collection windows sufficiently.
- Recommended order remains:
  - query-analysis (daily)
  - data-collection (multiple times daily)
  - analysis/content-generation/delivery

## Observability and Metrics

Track at minimum:

- query sets generated per day
- deterministic vs LLM query ratio
- per-intent distribution
- generation failures and fallback usage
- downstream yield (articles per query, selected articles per query)

## Error Handling

- If LLM fails: continue with deterministic-only set and mark fallback in metadata.
- If persistence fails: do not switch active set.
- If config is missing or malformed: use safe defaults and log warnings.

## Security and Compliance

- Agent communicates with agent-data-api using existing auth token flow.
- No direct DB access from agent process.
- Do not expose secrets in logs.

## Acceptance Criteria

- Daily query-analysis run creates one new active query set per ticker.
- Data-collection uses active set queries without manual intervention.
- Admin can change query count and allowed languages globally in Hermes.
- Query sets include deterministic and LLM-attributed query metadata.
- Historical query sets remain accessible for audit and analysis.
- On LLM failure, deterministic-only run still succeeds.
- Hermes **Search Queries** table exposes the extended column set so admins can audit active vs historical sets, intent, source, rank, and Hermes job linkage.

## Rollout Plan

### Phase 1

- Register `queryAnalysis` in `agentDataApiManifest` (v1/v2) and implement routes + Prisma services.
- Add `@workspace/agent-data-api-client` methods and tests.
- Add Prisma migration: `search_query_set` + extended `search_query`; enforce one active set per ticker.
- Update `dataCollection` GET to return only active-set queries (or document transitional behavior if migrating existing rows).
- Scaffold `apps/mediapulse/agents/query-analysis` (from turbo gen template) with deterministic baseline + LLM extension.
- Extend GET/POST Zod contracts to match this PRD; remove duplication/orphan status of old minimal-only shapes.
- Extend Hermes **Search Queries** list + `dashboard-page.ts` manifest per [Hermes dashboard: Search Queries table](#hermes-dashboard-search-queries-table) (join set, new columns, search/sort fields).

### Phase 2

- Add KG relation-change enrichment to GET context.
- Add metrics dashboards and quality monitoring.

### Phase 3

- Tune ranking and prompt strategy from production feedback.
- Consider per-ticker overrides (out of v1 scope).

## Risks and Mitigations

- Risk: low-quality LLM queries.
  - Mitigation: deterministic minimum, strict filters, scoring.
- Risk: config misuse by admins.
  - Mitigation: schema validation and safe defaults.
- Risk: active-set switching race conditions.
  - Mitigation: transactional writes and activation sequencing.

## Open Decisions

- Exact database migration shape for active-set enforcement.
- Exact thresholding for query quality filters.
- Whether novelty scoring compares against one or multiple past sets.
- How to migrate existing flat `SearchQuery` rows into a first active set without breaking data-collection.
