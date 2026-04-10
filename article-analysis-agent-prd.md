# Article Analysis Agent PRD

## Document Control

- Product: MediaPulse
- Feature: Article Analysis Agent
- Owner: Platform and Agents
- Status: Draft
- Last Updated: 2026-03-20

## Background

MediaPulse runs scheduled agents to collect, analyze, and deliver ticker-related news. The **data-collection** agent persists fetched articles as `DataSource` rows (linked to `SearchQuery` and `Ticker`). Downstream consumers need **structured understanding** of each article: which entities it mentions, how it relates to the knowledge graph, and whether it is **relevant enough** to surface in newsletters or other delivery.

The **agent-data-api** contract for analysis (`getAnalysis` / `postAnalysis`) already defines request and response shapes: load unanalyzed sources plus KG vocabulary, then persist extracted entities, relations, per-article mentions, and relevance scores. The database models (`Entity`, `EntityRelation`, `ArticleEntity`, `ArticleRelevance`, `TickerEntity`, etc.) align with that contract.

This PRD defines the **article-analysis agent**: the runtime that performs extraction and scoring and writes results through that API.

## Problem Statement

Without a dedicated article-analysis step:

- Collected text sits underused: no systematic entity linking or relation updates from new articles.
- Downstream features cannot distinguish **high-signal** articles from noise, duplicates, or off-topic hits.
- The knowledge graph does not grow in a controlled, reviewable way from news flow.

Operators and product need predictable, configurable analysis that respects **ticker scope**, **admin-defined entity/relation types**, and **selection rules** for delivery.

## Goals

- Analyze **fetched articles** (`DataSource`) per ticker using KG context (`EntityType`, `RelationType`, existing `Entity` records).
- Extract or reuse **entities** and **relations**, and record **per-article** mentions with optional **sentiment**.
- Produce **relevance scores** with a **transparent breakdown** and a **selected** flag for downstream pipelines.
- Support **incremental** runs: process only **unanalyzed** sources by default, with explicit **backfill** (`timeWindow`) and **re-scoring** (`reanalyze`) when operators need them.
- Integrate with **Hermes** configuration (model, limits, scoring weights) without code deploys for routine tuning.
- Align relevance priorities with the product order used elsewhere: **breaking news → KG relation changes → fundamentals** (as dimensions in scoring or ranking, not necessarily three separate agents).

## Non-Goals

- Replacing data-collection fetch or search providers.
- Full human-in-the-loop review UI for every extracted entity in v1.
- Real-time analysis on every partial fetch; v1 assumes **scheduled** or **batch** runs.
- Cross-ticker global deduplication of `DataSource` rows (URL dedup within ticker may be handled in collection or analysis as a separate decision).
- Per-ticker Hermes overrides in v1 (global config only), unless already established platform-wide for agents.

## Users and Stakeholders

- **Hermes admins:** configure analysis model, batch sizes, scoring weights, and safety limits.
- **Article-analysis agent:** loads context, runs extraction/scoring, posts results.
- **Downstream agents** (e.g. content generation, newsletter): consume `ArticleRelevance.selected` and linked entities.
- **Platform engineers:** maintain contracts, API handlers, and observability.

## Functional Requirements

### FR1: Scheduled or On-Demand Execution

- The article-analysis agent runs on the existing Hermes pipeline/schedule infrastructure (see **Scheduling and Pipeline Order** for cadence relative to data-collection).
- **Input schema (v1):**
  - `tickerId` (required).
  - `timeWindow` (optional): `{ start: ISO datetime, end: ISO datetime }` — limits which `DataSource` rows are eligible for this run (backfill, “yesterday only,” incident replay). When omitted, eligibility is driven by GET semantics and config (e.g. unanalyzed-only).
  - `maxBatchSize` (optional): upper bound on articles processed in one invocation; prevents runaway cost on large backlogs.
  - `reanalyze` (optional, default `false`): when `false`, routine runs use analysis GET with **`unanalyzed=true`** (steady state). When `true`, the agent requests sources eligible for **re-scoring** / overwrite of mentions and relevance (GET `unanalyzed=false` or equivalent API behavior). **Reanalyze runs must also set `timeWindow` and/or `maxBatchSize`** so operators cannot accidentally re-score an entire history without bounds.

### FR2: Load Analysis Context (GET)

- Call agent-data-api **analysis GET** with:
  - `tickerId`
  - `unanalyzed=true` for default incremental runs (`reanalyze=false`); `unanalyzed=false` when re-scoring or full eligible set per API contract (used with `reanalyze=true` and bounded scope).
- Consume response fields per contract:
  - `dataSources`: articles to analyze (ids, url, title, content, `createdAt`)
  - `entityTypes`, `relationTypes`: allowed vocabulary for extraction
  - `existingEntities`: for deduplication and alias matching

### FR3: Entity and Relation Extraction

- From article text, propose **new entities** (`canonicalName`, `typeId`, optional `description`, `aliases`).
- Propose **new relations** between named entities (`fromEntityName`, `toEntityName`, `relationTypeId`).
- Resolution rules:
  - Match proposed names against **existingEntities** and aliases before creating duplicates.
  - Only use `typeId` / `relationTypeId` values present in the GET response.
- Persist via **analysis POST** `entities` and `relations` arrays; API returns counts for `entitiesCreated`, `entitiesReused`, `relationsCreated`.

### FR4: Per-Article Entity Mentions (`articleEntities`)

- For each `dataSourceId`, emit mention rows: `entityName`, `mentionCount`, `confidence`, optional `sentiment`.
- Sentiment values must match contract enum: `POSITIVE`, `NEGATIVE`, `NEUTRAL`.
- Names must resolve to entities created or reused in the same run (or pre-existing), per API implementation.

### FR5: Relevance Scoring and Selection (`articleRelevances`)

- For each analyzed `dataSourceId`, compute `score` in `[0, 1]`.
- `scoreBreakdown` must be a **non-empty map** of string keys to numeric components. **Dashboards and cross-ticker reporting use a fixed v1 canonical key set**; additional experimental keys are allowed but should not be required for core charts.
  - **Canonical v1 keys** (names stable for observability): `breakingNews`, `kgRelation`, `fundamental`, `tickerSalience`, `sourceQuality` (boilerplate/domain/trust penalties may contribute negatively or as sub-scores per implementation). Optional later: `dedupOrOverlap` (penalty when overlapping another selected article).
  - Include **`_version`** (integer, e.g. `1`) in `scoreBreakdown` so breakdown semantics can evolve without breaking dashboards.
- `selected` indicates inclusion for the next downstream step; selection logic must be **documented** and **configurable** (see Hermes config).
- API returns `articlesScored` and `articlesSelected` counts.

### FR6: Validation and Safety

- All LLM or heuristic outputs must be **validated** against `postAnalysisBodySchema` before POST.
- Reject or clamp invalid numeric ranges; fail the **item** or **batch slice** with structured error rather than persisting corrupt rows.
- Enforce **maximum** entities/relations per article and per run to control cost (configurable).

### FR7: Partial Failure and Idempotency

- Failure for one article must not necessarily fail the entire run; follow the same **partial success** philosophy as data-collection hardening where applicable.
- Re-running analysis on the same source:
  - **Default:** **skip** already analyzed rows via GET `unanalyzed=true` when `reanalyze=false`.
  - **Re-scoring:** when `reanalyze=true` (with `timeWindow` and/or `maxBatchSize`), **upsert** `ArticleEntity` / `ArticleRelevance` (and related graph updates) per API behavior so operators can fix bad runs without duplicating rows.

### FR8: Auth and Transport

- Use existing agent-data-api **token** auth; no direct database access from the agent process.

### FR9: Chunked POST Bodies

- Do not send unbounded single POST payloads for large batches: **split writes into chunks** (configurable, default range **10–50 articles** per POST, tuned with max content length).
- Process chunks **sequentially per ticker** to respect rate limits and simplify retries; parallelize across **different tickers** only when provider and API quotas allow.
- Each chunk is validated independently; partial failure on one chunk must not discard successful prior chunks without explicit operator policy.

## Analysis Pipeline (Recommended)

### Phase A — Prepare

1. GET analysis context for ticker: **`unanalyzed=true`** when `reanalyze=false`; when `reanalyze=true`, use API semantics that return bounded eligible sources (per `timeWindow` / `maxBatchSize` as implemented server- or client-side).
2. If `dataSources` is empty, exit success with zero counts.
3. If the eligible set exceeds **`maxBatchSize`**, process only the first N (deterministic ordering, e.g. by `createdAt`) or rely on API pagination if added later.

### Phase B — Extract (LLM or hybrid)

1. Optional: **truncate or summarize** long `content` for extraction if over token budget (configurable); retain **full text** for storage already in DB.
2. Run structured extraction with **entity/relation types** embedded in the prompt.
3. Normalize names (trim, consistent casing for matching against existing entities).

### Phase C — Resolve and persist graph

1. Map extracted names to existing entities or new creates.
2. POST entities and relations in **chunks** per **FR9** (ordering must satisfy API expectations if dependencies exist).

### Phase D — Mentions

1. Build `articleEntities` rows per source with counts and confidence.
2. POST with mentions in the same chunk as related graph rows when the contract allows; otherwise sequence POSTs so dependencies resolve.

### Phase E — Score and select

1. Compute heuristic and/or LLM-assisted **relevance** with explicit **breakdown** fields (canonical keys and `_version` per **FR5**).
2. Apply **selection** rules (top-K per ticker per day, threshold, diversity caps).
3. POST `articleRelevances` using **chunked** requests per **FR9**.

**Note:** Logical phases B–E may be merged into fewer LLM calls; **writes** to agent-data-api should still follow **FR9** chunk sizes even when extraction is single-pass.

## Contract Alignment

The implementation must stay aligned with:

- `packages/agent-data-api-contract/src/analysis.ts` — Zod schemas for GET query, GET response, POST body, POST response.

Database concepts (for traceability, not direct agent access):

- `DataSource`, `ArticleEntity`, `ArticleRelevance`, `Entity`, `EntityAlias`, `EntityRelation`, `TickerEntity`, `EntityType`, `RelationType`.

## Hermes Admin Configuration (Initial Proposal)

Global keys (names illustrative; final names follow env package conventions):

- **Model:** e.g. `ARTICLE_ANALYSIS_MODEL`, token limits.
- **Batching:** max articles per run (`maxBatchSize` default), **chunk size** for POST bodies (10–50 articles), max content length / summary toggle.
- **Debouncing (optional):** see **Scheduling and Pipeline Order** — agent-side guards (`min` interval / `min` unanalyzed backlog) when Hermes invokes analysis on a fixed schedule; complements (does not replace) dashboard schedules.
- **Extraction caps:** max new entities per article, max relations per article.
- **Scoring weights:** map **canonical** breakdown keys to weights for final `score`; `ARTICLE_ANALYSIS_SCORE_BREAKDOWN_VERSION` (integer) should match `_version` embedded in POST bodies for dashboards.
- **Selection:** `ARTICLE_ANALYSIS_MAX_SELECTED_PER_TICKER_PER_DAY`, minimum score threshold, optional intent mix caps mirroring query-analysis priorities.
- **Provider:** API keys for LLM provider (server-only; no `NEXT_PUBLIC_`).

## Scheduling and Pipeline Order

### Dependency order (what must run before what)

1. Query analysis (daily) — active query sets.
2. Data-collection (multiple times daily).
3. **Article analysis** — consumes `DataSource` rows written by data-collection.
4. Content generation / newsletter / delivery.

This is **logical order**, not “one pipeline step immediately triggers the next.” Each stage is **scheduled in Hermes** the way admins already configure pipelines and schedules.

### What admins do in Hermes (dashboard)

- **Separate schedules** for **data-collection** and **article-analysis** (separate pipeline schedules, or separate steps with their own triggers—whatever Hermes supports in your deployment).
- **Article analysis should run on a slower cadence than data-collection** unless product needs near-real-time scoring. Example: collection every **2 hours**, analysis **2–4× per day** or **daily**; for fresher selection, analysis **hourly** (higher LLM cost).
- **Stagger clock times** so analysis runs **after** collection has time to finish and persist rows—for example, collection at `:05` past the hour and analysis at `:45`, or analysis in a quiet window after the last collection of the day. Goal: avoid starting analysis while `DataSource` rows for that window are still being written.
- **No extra scheduler product** is required: the PRD targets **cron/schedule choices** admins enter in Hermes plus optional **agent config** below.

### Why analysis does not run after every collection tick

Each article-analysis invocation calls the API with **`unanalyzed=true`** (default) and processes **every eligible backlog** since the previous successful analysis, up to `maxBatchSize`. So Hermes can trigger analysis **less often** than collection; one run **batches** multiple collection cycles. That is the intended meaning of “not necessarily after every collection run.”

### Debouncing (Hermes schedule + optional agent guards)

Hermes still fires on a **fixed schedule**. **Debouncing** means:

- **Optional Hermes variables** (see Hermes Admin Configuration): e.g. **minimum unanalyzed article count** before doing LLM work, or **minimum minutes since last successful analysis** for the same ticker.
- The agent **exits successfully with no-op** when guards say “nothing worth doing,” so admins are not forced to micro-manage cron for every edge case.

Debouncing **adds** to dashboard scheduling; it does **not** replace it.

## Observability and Metrics

Track at minimum:

- Articles processed, succeeded, failed (per stage: extract, score, persist).
- Entity create vs reuse ratio; relation create count.
- Distribution of `score` and count of `selected`; breakdown by **canonical** keys and `_version`.
- Token usage and latency per run (if available).
- Validation failures (schema vs semantic).

## Error Handling

- **Empty GET:** success, no POST required.
- **LLM failure:** mark articles failed with diagnostic; continue with remaining batches if partial mode enabled.
- **POST partial failure:** surface API error; do not claim success for persisted counts unless API confirms.

## Security and Compliance

- No secrets in logs; redact article content in debug logs or use ids only.
- Respect data retention policies for stored `content` (already on `DataSource`).

## Acceptance Criteria

- Agent loads analysis context via GET and persists results via POST matching contract schemas; large runs use **chunked POSTs** per **FR9**.
- Default runs (`reanalyze=false`) use **unanalyzed** sources only and do not reprocess already analyzed sources (per API semantics). **Reanalyze** runs are **bounded** by `timeWindow` and/or `maxBatchSize`.
- Relevance scores include interpretable `scoreBreakdown` with **canonical v1 keys** and `_version`; `selected` reflects configurable rules.
- Entities and relations use only allowed type IDs from GET.
- Partial failures produce diagnosable logs/metrics without corrupting validated data.

## Rollout Plan

### Phase 1

- Implement article-analysis agent with GET/POST integration and deterministic validation.
- Single-pass or two-pass extraction+scoring behind a config flag.

### Phase 2

- Tune scoring weights and selection from production metrics; optional second-pass for relevance-only re-scoring.

### Phase 3

- Richer KG feedback loops (e.g. relation deltas from query-analysis context), admin diagnostics UI.

## Risks and Mitigations

- **Risk:** LLM hallucinated entities — **Mitigation:** strict type IDs, alias matching, caps, and optional confidence thresholds.
- **Risk:** runaway cost on large batches — **Mitigation:** `maxBatchSize`, chunk sizes for POSTs, content truncation/summarization, debounced schedules, rate limits.
- **Risk:** selection too aggressive or too sparse — **Mitigation:** configurable thresholds, monitoring of `articlesSelected` vs processed.
