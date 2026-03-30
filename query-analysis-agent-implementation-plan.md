# Query Analysis Agent — Implementation Plan

- Feature: Query Analysis Agent
- PRD: `query-analysis-agent-prd.md`
- Status: Implementation ready
- Last Updated: 2025-07-15

---

## 0. Reading this document

Each step lists **files to create or modify**, **what to do**, and **why**. Steps are ordered so that
each one can compile against what exists after all previous steps are complete.  The plan follows the
three PRD phases but breaks them into individually mergeable work items.

---

## Phase 1 — Data layer, API contract, and agent scaffold

### Step 1 — Prisma migration: `search_query_set` + extend `search_query`

**Files to create/modify**

| Action | Path |
|--------|------|
| Modify | `packages/mediapulse/database/prisma/schema.prisma` |
| Create | `packages/mediapulse/database/prisma/migrations/<timestamp>_add_search_query_set/migration.sql` |

**Schema changes**

Add a new `SearchQuerySet` model above `SearchQuery`:

```prisma
enum QuerySource {
  DETERMINISTIC
  LLM

  @@map("query_source")
}

enum QueryIntent {
  BREAKING
  KG_CHANGE
  FUNDAMENTAL

  @@map("query_intent")
}

/// Versioned container for a daily batch of generated search queries for one ticker.
model SearchQuerySet {
  id                 String   @id @default(uuid())
  tickerId           String   @map("ticker_id")
  generatedAt        DateTime @default(now()) @map("generated_at")
  isActive           Boolean  @default(false) @map("is_active")
  strategySnapshot   Json     @map("strategy_snapshot")
  generationSource   String   @map("generation_source")
  agentJobId         String?  @map("agent_job_id")
  createdAt          DateTime @default(now()) @map("created_at")

  ticker        Ticker        @relation(fields: [tickerId], references: [id])
  searchQueries SearchQuery[]

  @@index([tickerId, isActive])
  @@map("search_query_set")
}
```

Extend the existing `SearchQuery` model — add the four new columns (`setId`, `source`, `intent`,
`rank`) while keeping `tickerId` for backwards compatibility during the migration window:

```prisma
model SearchQuery {
  id        String       @id @default(uuid())
  text      String
  tickerId  String       @map("ticker_id")
  setId     String?      @map("set_id")          // nullable until backfill migration runs
  source    QuerySource? @map("source")
  intent    QueryIntent? @map("intent")
  rank      Int?         @map("rank")
  createdAt DateTime     @default(now()) @map("created_at")
  updatedAt DateTime     @updatedAt @map("updated_at")

  ticker      Ticker          @relation(fields: [tickerId], references: [id])
  set         SearchQuerySet? @relation(fields: [setId], references: [id])
  dataSources DataSource[]

  @@map("search_query")
}
```

Also add the reverse relation on `Ticker`:

```prisma
searchQuerySets SearchQuerySet[]
```

**Migration SQL notes**

The generated migration will add the `search_query_set` table and the nullable columns to
`search_query`. No data loss occurs; existing rows will have `set_id IS NULL` and will continue to be
served by `dataCollection.get` until Step 5 updates that handler. Run the migration via:

```
pnpm --filter @mediapulse/database db:migrate:dev
```

---

### Step 2 — Extend the Zod contract (`query-analysis.ts`)

**File to modify**

`packages/shared/agent-data-api-contract/src/query-analysis.ts`

**Replace the file contents** with the full PRD-aligned schemas. Keep all existing exported names so
nothing currently importing the file breaks.

New/changed schemas:

1. **`postQueryAnalysisBodySchema`** — enrich from the minimal `{ tickerId, queries[{ text }] }` to:
   - `queries`: each item gains `source` (`"deterministic" | "llm"`), `intent`
     (`"breaking" | "kg_change" | "fundamental"`), `rank` (`number`)
   - `strategySnapshot`: `z.record(z.unknown())` — immutable snapshot of config at generation time
   - `agentJobId`: `z.string().optional()` — from `X-Job-Id` header
   - `generationSource`: `z.string()` — e.g. `"hybrid_v1"`

2. **`postQueryAnalysisResponseSchema`** — replace `{ created }` with:
   - `created`: number of inserted rows
   - `setId`: UUID of the newly created set
   - `activeSetId`: UUID of the now-active set (equal to `setId` when activation succeeds)

3. **`getQueryAnalysisResponseSchema`** — add optional fields alongside the current ones:
   - `globalConfigSnapshot`: `z.record(z.unknown()).optional()` — config keys in effect at request time
   - Keep `ticker`, `topEntities`, `recentThemes` unchanged

Add and export the new helper schemas:

```typescript
export const queryAnalysisQueryItemSchema = z.object({
  text: z.string().trim().min(1),
  source: z.enum(["deterministic", "llm"]),
  intent: z.enum(["breaking", "kg_change", "fundamental"]),
  rank: z.number().int().nonnegative(),
});
```

Export all new types (`PostQueryAnalysisBody`, `PostQueryAnalysisResponse`, etc.) — replace the old
inferred types with the new ones derived from the updated schemas.

---

### Step 3 — Register `queryAnalysis` in `agentDataApiManifest`

**File to modify**

`packages/shared/agent-data-api-contract/src/agent-data-api-manifest.ts`

**What to do**

1. Import the four new schemas from `./query-analysis.js`:
   ```typescript
   import {
     getQueryAnalysisQuerySchema,
     getQueryAnalysisResponseSchema,
     postQueryAnalysisBodySchema,
     postQueryAnalysisResponseSchema,
   } from "./query-analysis.js";
   ```

2. Add the `queryAnalysis` entry to `agentDataApiManifest` for both `v1` and `v2`:
   ```typescript
   queryAnalysis: {
     v1: {
       get: {
         query: getQueryAnalysisQuerySchema,
         response: getQueryAnalysisResponseSchema,
       },
       post: {
         body: postQueryAnalysisBodySchema,
         response: postQueryAnalysisResponseSchema,
       },
     },
     v2: {
       get: {
         query: getQueryAnalysisQuerySchema,
         response: getQueryAnalysisResponseSchema,
       },
       post: {
         body: postQueryAnalysisBodySchema,
         response: postQueryAnalysisResponseSchema,
       },
     },
   },
   ```

**Effect**: the SDK (`agent-data-api-client`) automatically gains a typed
`client.queryAnalysis.get(...)` and `client.queryAnalysis.create(...)` because `createAgentDataApiClient`
is driven entirely by the manifest. No further SDK changes are required.

---

### Step 4 — Implement `query-analysis` routes and service in `agent-data-api`

**Files to create**

| Action | Path |
|--------|------|
| Create | `apps/mediapulse/agent-data-api/src/services/query-analysis.ts` |
| Create | `apps/mediapulse/agent-data-api/src/services/query-analysis.test.ts` |
| Create | `apps/mediapulse/agent-data-api/src/routes/query-analysis.ts` |

**Modify**

`apps/mediapulse/agent-data-api/src/index.ts`

---

#### `services/query-analysis.ts`

Expose two functions:

**`getQueryAnalysisContext(tickerId: string, configSnapshot?: Record<string, unknown>)`**

Uses `prisma` to:
1. Find the `Ticker` by `id` (throw `404`-style error when not found).
2. Fetch top `TickerEntity` rows for the ticker, joining `Entity` and `EntityType`, ordered by
   `relevanceWeight` descending, limited to 20.
3. Fetch distinct themes from recent `ArticleEntity` join `ArticleRelevance` within the last 14 days
   for this ticker, counting occurrences — limited to 10.
4. Return the shape that matches `getQueryAnalysisResponseSchema`:
   ```typescript
   {
     ticker: { id, symbol, name, metadata },
     topEntities: [{ canonicalName, typeName, relevanceWeight }],
     recentThemes: [{ theme, articleCount }],
     globalConfigSnapshot: configSnapshot ?? undefined,
   }
   ```

**`persistQuerySet(tickerId: string, body: PostQueryAnalysisBody)`**

Uses a `prisma.$transaction` to:
1. Create a `SearchQuerySet` row: `{ tickerId, isActive: false, strategySnapshot, generationSource,
   agentJobId }`.
2. Bulk-insert `SearchQuery` rows with `setId` pointing at the new set, including `source`, `intent`,
   `rank`, and `tickerId` (keep both for compatibility).
3. Deactivate all existing active sets for this ticker:
   `prisma.searchQuerySet.updateMany({ where: { tickerId, isActive: true }, data: { isActive: false } })`.
4. Mark the new set as active: `prisma.searchQuerySet.update({ where: { id: newSetId }, data: { isActive: true } })`.
5. Return `{ created: queries.length, setId: newSetId, activeSetId: newSetId }`.

Steps 3 and 4 together enforce the "exactly one active set per ticker" invariant atomically.

---

#### `routes/query-analysis.ts`

Mirror the pattern from `routes/data-collection.ts`:

```typescript
export async function getQueryAnalysis(context: Context): Promise<Response>
export async function postQueryAnalysis(context: Context): Promise<Response>
```

`getQueryAnalysis`:
- Parse query with `getQueryAnalysisQuerySchema.parse(context.req.query())`
- Optionally build a `globalConfigSnapshot` from env keys (see Step 6) — pass through even if some
  keys are absent; omit the field entirely when env is not configured.
- Call `getQueryAnalysisContext(tickerId, configSnapshot)`.
- Return `context.json(data, 200)` or `internalError`.

`postQueryAnalysis`:
- Parse body with `postQueryAnalysisBodySchema.parseAsync(await context.req.json())`.
- Call `persistQuerySet(body.tickerId, body)`.
- Return `context.json(result, 200)` or `internalError`.

---

#### `index.ts` changes

Add the import and register handlers:

```typescript
import {
  getQueryAnalysis,
  postQueryAnalysis,
} from "./routes/query-analysis.js";

// In routeHandlers:
queryAnalysis: {
  get: getQueryAnalysis,
  post: postQueryAnalysis,
},
```

Because `registerAgentDataApiRoutes` iterates over every key in the manifest, adding the handlers
here is all that is required — the route segment `/query-analysis` will be mounted automatically.

---

### Step 5 — Update `dataCollection` GET to return only active-set queries

**File to modify**

`apps/mediapulse/agent-data-api/src/routes/data-collection.ts`

**Current behaviour**: `prisma.searchQuery.findMany({ where: { tickerId } })` — returns all rows
regardless of set membership.

**Target behaviour**: Return rows only from the active set when one exists; fall back to all rows for
a ticker if no set is active (safe transitional behaviour for tickers with legacy flat rows).

Implementation:

```typescript
// In getDataCollection:
const activeSet = await prisma.searchQuerySet.findFirst({
  where: { tickerId: query.tickerId, isActive: true },
  select: { id: true },
});

const data = await prisma.searchQuery.findMany({
  where: {
    tickerId: query.tickerId,
    ...(activeSet ? { setId: activeSet.id } : { setId: null }),
    ...(query.start && query.end
      ? { createdAt: { gte: new Date(query.start), lte: new Date(query.end) } }
      : {}),
  },
});
```

The `setId: null` branch covers the period before any set is generated (existing flat rows). Once the
agent runs for the first time for a ticker, that ticker's results will come only from the active set.

**Backfill consideration**: Document in dev-docs (Step 12) that existing `SearchQuery` rows with
`set_id IS NULL` will remain reachable through the `setId: null` fallback and should be cleaned up
or assigned to a bootstrap set via a one-off script after the first agent run per ticker.

---

### Step 6 — Add `query-analysis` env keys to `@mediapulse/env`

**Files to create/modify**

| Action | Path |
|--------|------|
| Create | `packages/mediapulse/env/src/agents-query-analysis.ts` |
| Create | `packages/mediapulse/env/env.agents.query-analysis.example` |

**`agents-query-analysis.ts`**

Follow the exact pattern of `agents-content-generation.ts` — use `createEnv` from `@t3-oss/env-nextjs`:

```typescript
export const env = createEnv({
  server: {
    PORT: z.number({ coerce: true }).optional(),
    AGENT_DATA_API_URL: z.string().min(1),
    AGENT_AUTH_API_URL: z.string().min(1),
    AGENT_REGISTRY_URL: z.string().min(1),
    AGENT_PUBLIC_URL: z.string().min(1),
    DOMAIN_INTEGRATION_API_KEY: z.string().min(1),
    DOMAIN_INTEGRATION_KEY: z.string().min(1),
    // Query-analysis specific
    OPENAI_API_KEY: z.string().min(1),
    OPENAI_MODEL: z.string().optional(),
    QUERY_ANALYSIS_QUERY_COUNT: z.number({ coerce: true }).optional(),
    QUERY_ANALYSIS_ALLOWED_LANGUAGES: z.string().optional(), // JSON string array
    QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT: z.number({ coerce: true }).optional(),
    QUERY_ANALYSIS_WEIGHT_BREAKING: z.number({ coerce: true }).optional(),
    QUERY_ANALYSIS_WEIGHT_KG_CHANGE: z.number({ coerce: true }).optional(),
    QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL: z.number({ coerce: true }).optional(),
    QUERY_ANALYSIS_MODEL: z.string().optional(),
    QUERY_ANALYSIS_MAX_TOKENS: z.number({ coerce: true }).optional(),
  },
  ...
});
```

**`env.agents.query-analysis.example`**

Mirror the style of `env.agents.content-generation.example`:

```
# Port this agent listens on (query-analysis: 4004)
PORT=4004 #number #default
AGENT_DATA_API_URL="http://localhost:8081" # required
AGENT_AUTH_API_URL="http://localhost:8080" # required
AGENT_REGISTRY_URL="http://localhost:8082" # required
AGENT_PUBLIC_URL="http://localhost:4004" # required
DOMAIN_INTEGRATION_API_KEY= # required
DOMAIN_INTEGRATION_KEY=mediapulse # required # default

# OpenAI LLM (shared with content-generation; can share the same key)
OPENAI_API_KEY= # required
OPENAI_MODEL=gpt-4o-mini # default

# Query generation settings (all optional; safe defaults apply)
QUERY_ANALYSIS_QUERY_COUNT=12 #number #default
QUERY_ANALYSIS_ALLOWED_LANGUAGES=["en"] # JSON array #default
QUERY_ANALYSIS_MIN_DETERMINISTIC_COUNT=4 #number #default
QUERY_ANALYSIS_WEIGHT_BREAKING=3 #number #default
QUERY_ANALYSIS_WEIGHT_KG_CHANGE=2 #number #default
QUERY_ANALYSIS_WEIGHT_FUNDAMENTAL=1 #number #default
QUERY_ANALYSIS_MODEL=gpt-4o-mini # default (overrides OPENAI_MODEL for this agent)
QUERY_ANALYSIS_MAX_TOKENS=1024 #number #default
```

**Note**: The env file should be added to `merge-env-examples.sh` so it is automatically merged into
the shared `.env` file during local dev setup.

---

### Step 7 — Extend Hermes Search Queries dashboard

**Files to modify**

| Path |
|------|
| `apps/mediapulse/domain-api/src/resources/search-queries/list-mapper.ts` |
| `apps/mediapulse/domain-api/src/resources/search-queries/routes.ts` |
| `apps/mediapulse/domain-api/src/resources/search-queries/dashboard-page.ts` |

---

#### `list-mapper.ts`

Update `listInclude` to join `SearchQuerySet`:

```typescript
export const listInclude = {
  ticker: {
    select: { symbol: true, name: true },
  },
  set: {
    select: {
      id: true,
      isActive: true,
      generatedAt: true,
      generationSource: true,
      agentJobId: true,
    },
  },
} satisfies Prisma.SearchQueryInclude;
```

Update `mapRowToListItem` to expose all the new PRD columns:

```typescript
export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  text: row.text,
  tickerSymbol: row.ticker.symbol,
  tickerName: row.ticker.name,
  activeSet: row.set?.isActive ? "Yes" : "No",
  intent: row.intent ?? "",
  rank: row.rank !== null && row.rank !== undefined ? String(row.rank) : "",
  source: row.source === "DETERMINISTIC"
    ? "Deterministic"
    : row.source === "LLM"
    ? "LLM"
    : "",
  setGeneratedAt: row.set?.generatedAt?.toISOString() ?? null,
  generationPipeline: row.set?.generationSource ?? "",
  querySetId: row.set?.id ?? "",
  agentJobId: row.set?.agentJobId ?? "",
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
```

---

#### `routes.ts`

Extend the `where` clause to support the new searchable fields (`intent`, `source`, `querySetId`,
`agentJobId`):

```typescript
const where: Prisma.SearchQueryWhereInput | undefined = query
  ? {
      OR: [
        { text: { contains: query, mode: "insensitive" } },
        { ticker: { name: { contains: query, mode: "insensitive" } } },
        { ticker: { symbol: { contains: query, mode: "insensitive" } } },
        { intent: { equals: query as QueryIntent } },        // enum exact match
        { source: { equals: query as QuerySource } },        // enum exact match
        { set: { id: { contains: query, mode: "insensitive" } } },
        { set: { agentJobId: { contains: query, mode: "insensitive" } } },
      ],
    }
  : undefined;
```

Update `orderBy` to allow sorting by `setGeneratedAt` and `rank` in addition to `createdAt`. The
Hermes `table-v1` client sends `?sort=<field>&order=asc|desc`; parse and map these parameters.

---

#### `dashboard-page.ts`

Replace the current 4-column definition with the full 14-column manifest from the PRD:

```typescript
columns: columnsFor<ListItem>()([
  { key: "tickerSymbol",       label: "Ticker",             type: "text"      },
  { key: "tickerName",         label: "Ticker Name",        type: "text"      },
  { key: "text",               label: "Search Query",       type: "text"      },
  { key: "activeSet",          label: "Active set",         type: "text"      },
  { key: "intent",             label: "Intent",             type: "text"      },
  { key: "rank",               label: "Rank",               type: "text"      },
  { key: "source",             label: "Source",             type: "text"      },
  { key: "setGeneratedAt",     label: "Set generated",      type: "date-time" },
  { key: "generationPipeline", label: "Generation pipeline",type: "text"      },
  { key: "querySetId",         label: "Query set id",       type: "text"      },
  { key: "agentJobId",         label: "Hermes job id",      type: "text"      },
  { key: "createdAt",          label: "Created",            type: "date-time" },
  { key: "updatedAt",          label: "Updated",            type: "date-time" },
]),
searchableFields: rowFieldKeysFor<ListItem>()([
  "tickerName", "tickerSymbol", "text", "intent", "source", "querySetId", "agentJobId",
]),
sortableFields: rowFieldKeysFor<ListItem>()([
  "createdAt", "setGeneratedAt", "rank", "activeSet",
]),
```

---

### Step 8 — Extend `agent-runtime` to expose `X-Job-Id`

**Files to modify**

| Path |
|------|
| `packages/shared/agent-runtime/src/types.ts` |
| `packages/shared/agent-runtime/src/hermes-invoke-correlation.ts` |
| `packages/shared/agent-runtime/src/hermes-invoke-correlation.test.ts` |

**Why**: The PRD requires persisting `agentJobId` (from `X-Job-Id`) on `SearchQuerySet`. The current
runtime only surfaces `X-Schedule-Id`, `X-Schedule-Execution-Id`, and `X-Pipeline-Step-Id`.

**`types.ts`** — add the optional field to `HermesInvokeCorrelation`:

```typescript
export type HermesInvokeCorrelation = {
  scheduleId?: string;
  scheduleExecutionId?: string;
  pipelineStepId?: string;
  /** Hermes `AgentJobExecution.jobId` when `X-Job-Id` was sent by the worker. */
  agentJobId?: string;
};
```

**`hermes-invoke-correlation.ts`** — add the constant and read it:

```typescript
export const HERMES_HEADER_JOB_ID = "X-Job-Id";

// In hermesInvokeCorrelationFromGetHeader:
const agentJobId = getHeader(HERMES_HEADER_JOB_ID)?.trim();

const correlation: HermesInvokeCorrelation = {
  ...(scheduleId ? { scheduleId } : {}),
  ...(scheduleExecutionId ? { scheduleExecutionId } : {}),
  ...(pipelineStepId ? { pipelineStepId } : {}),
  ...(agentJobId ? { agentJobId } : {}),
};

// Update the early-return guard to include agentJobId:
if (
  correlation.scheduleId === undefined &&
  correlation.scheduleExecutionId === undefined &&
  correlation.pipelineStepId === undefined &&
  correlation.agentJobId === undefined
) {
  return undefined;
}
```

Update the test file to cover the `agentJobId` presence/absence cases.

---

### Step 9 — Scaffold the agent package

**Files to create**

```
apps/mediapulse/agents/query-analysis/
  package.json
  tsconfig.json
  turbo.json
  vitest.config.ts
  Dockerfile
  fly.toml
  src/
    index.ts
    config-schema.ts
    deterministic-generator.ts
    llm-generator.ts
    query-ranker.ts
```

**`package.json`**

Derive from `agents/content-generation/package.json`. Key differences:
- `name`: `@mediapulse/agent-query-analysis`
- `dependencies`: keep `openai`, `@workspace/agent-data-api-client`, `@workspace/agent-runtime`,
  `@mediapulse/env` (export path `agents-query-analysis`), `@workspace/logger`, `zod`.
- Port default: `4004`.

**`turbo.json` / `tsconfig.json` / `vitest.config.ts`**

Copy verbatim from `agents/content-generation` — these are identical across agents.

**`Dockerfile`**

Copy from `agents/content-generation/Dockerfile` — only the `CMD` port constant differs.

---

### Step 10 — Implement the agent

#### `src/config-schema.ts`

Defines the `ConfigSchema` consumed from the `config` envelope field by the Hermes worker:

```typescript
export const ConfigSchema = z.object({
  openaiApiKey: z.string().min(1),
  openaiModel: z.string().optional(),
  queryCount: z.number().int().positive().default(12),
  minDeterministicCount: z.number().int().nonnegative().default(4),
  allowedLanguages: z.array(z.string()).default(["en"]),
  weightBreaking: z.number().nonnegative().default(3),
  weightKgChange: z.number().nonnegative().default(2),
  weightFundamental: z.number().nonnegative().default(1),
  maxTokens: z.number().int().positive().default(1024),
});
export type QueryAnalysisConfig = z.infer<typeof ConfigSchema>;
```

All fields have defaults so the agent is resilient to partially supplied configs.

---

#### `src/deterministic-generator.ts`

Pure function — no I/O, easy to unit-test:

```typescript
export interface TickerContext {
  symbol: string;
  name: string;
  topEntities: Array<{ canonicalName: string; typeName: string }>;
  recentThemes: Array<{ theme: string }>;
}

export interface DeterministicQuery {
  text: string;
  intent: "breaking" | "kg_change" | "fundamental";
}

export function generateDeterministicQueries(
  ticker: TickerContext,
  minCount: number,
): DeterministicQuery[]
```

Template set (extend as needed):

| Intent | Template |
|--------|----------|
| `breaking` | `{symbol} latest news` |
| `breaking` | `{name} breaking news` |
| `fundamental` | `{name} earnings guidance` |
| `fundamental` | `{name} quarterly results` |
| `fundamental` | `{name} regulatory update` |
| `fundamental` | `{name} partnership announcement` |
| `kg_change` | `{entity} {ticker} latest` (for top 2 entities) |
| `kg_change` | `{theme} {ticker}` (for top 2 themes) |

The function fills templates, deduplicates on normalized text (lower-case trim), and returns at least
`minCount` entries by cycling through templates if needed.

---

#### `src/llm-generator.ts`

Async function wrapping the OpenAI call:

```typescript
export async function generateLlmQueries(
  ticker: TickerContext,
  existingTexts: string[],
  config: { openai: OpenAI; model: string; maxTokens: number; targetCount: number },
): Promise<Array<{ text: string; intent: "breaking" | "kg_change" | "fundamental" }>>
```

Prompt design:
- System prompt: instructs the model to return a JSON array `[{ text, intent }]` where `intent` is
  one of the three values, avoiding duplicates from `existingTexts`.
- User prompt: includes ticker symbol, name, top entities, recent themes, and the list of already-
  generated deterministic texts so the LLM only adds novel queries.
- Parse response with `z.array(z.object({ text: z.string(), intent: z.enum([...]) }))`.
- On parse failure or network error: log a warning and return `[]` (LLM failure is non-fatal; FR7).

---

#### `src/query-ranker.ts`

Pure function — merges deterministic and LLM candidates, enforces limits, and assigns ranks:

```typescript
export interface RawCandidate {
  text: string;
  source: "deterministic" | "llm";
  intent: "breaking" | "kg_change" | "fundamental";
}

export interface RankedQuery extends RawCandidate {
  rank: number;
}

export function rankAndTrim(
  candidates: RawCandidate[],
  config: {
    queryCount: number;
    weights: { breaking: number; kg_change: number; fundamental: number };
  },
): RankedQuery[]
```

Algorithm:
1. Normalize text (lower-case trim) and deduplicate — first occurrence wins.
2. Score each candidate: `intentWeight * (source === "deterministic" ? 1.1 : 1.0)` (small bias for
   deterministic to ensure minimum baseline coverage).
3. Sort by score descending, then limit to `queryCount`.
4. Assign `rank` as the 1-based position in the trimmed list.
5. Return the result.

---

#### `src/index.ts`

Main entry point — assembles the agent using `createAgentApp`:

```typescript
const app = createAgentApp(
  {
    agentId: "query-analysis",
    agentVersion: "1.0.0",
    description: "Generates versioned ticker search query sets using deterministic templates and LLM.",
    inputSchema: BodySchema,     // z.object({ tickerId: z.string() })
    configSchema: ConfigSchema,
    run: async ({ input, config, token, hermesCorrelation }) => {
      const dataApiClient = createAgentDataApiClient({
        baseUrl: env.AGENT_DATA_API_URL,
        version: "v1",
        token,
      });

      // Step 1 — Fetch context
      const context = await dataApiClient.queryAnalysis.get({ tickerId: input.tickerId });

      // Step 2 — Deterministic baseline
      const deterministicQueries = generateDeterministicQueries(
        { symbol: context.ticker.symbol, name: context.ticker.name,
          topEntities: context.topEntities, recentThemes: context.recentThemes },
        config.minDeterministicCount,
      );

      // Step 3 — LLM enrichment (non-fatal on failure)
      let llmQueries: Array<{ text: string; intent: QueryIntent }> = [];
      try {
        const openai = new OpenAI({ apiKey: config.openaiApiKey });
        llmQueries = await generateLlmQueries(
          { ... },
          deterministicQueries.map(q => q.text),
          { openai, model: config.openaiModel ?? "gpt-4o-mini",
            maxTokens: config.maxTokens, targetCount: config.queryCount },
        );
      } catch (err) {
        logger.warn({ err, tickerId: input.tickerId }, "LLM query generation failed; using deterministic-only set");
      }

      // Step 4 — Merge, rank, trim
      const candidates: RawCandidate[] = [
        ...deterministicQueries.map(q => ({ ...q, source: "deterministic" as const })),
        ...llmQueries.map(q => ({ ...q, source: "llm" as const })),
      ];
      const ranked = rankAndTrim(candidates, {
        queryCount: config.queryCount,
        weights: { breaking: config.weightBreaking, kg_change: config.weightKgChange,
                   fundamental: config.weightFundamental },
      });

      // Step 5 — Build strategy snapshot (no secrets)
      const strategySnapshot = {
        queryCount: config.queryCount,
        minDeterministicCount: config.minDeterministicCount,
        allowedLanguages: config.allowedLanguages,
        weights: { breaking: config.weightBreaking, kg_change: config.weightKgChange,
                   fundamental: config.weightFundamental },
        model: config.openaiModel ?? "gpt-4o-mini",
        maxTokens: config.maxTokens,
        generatedAt: new Date().toISOString(),
      };

      // Step 6 — Persist
      const result = await dataApiClient.queryAnalysis.create({
        tickerId: input.tickerId,
        queries: ranked.map(q => ({ text: q.text, source: q.source, intent: q.intent, rank: q.rank })),
        strategySnapshot,
        generationSource: "hybrid_v1",
        agentJobId: hermesCorrelation?.agentJobId,
      });

      logger.info(
        { tickerId: input.tickerId, setId: result.setId,
          agentJobId: hermesCorrelation?.agentJobId ?? null, created: result.created },
        "Query set persisted and activated",
      );

      return { success: true };
    },
  },
  {
    authApiUrl: env.AGENT_AUTH_API_URL,
    autoRegister: env.AGENT_REGISTRY_URL && env.DOMAIN_INTEGRATION_API_KEY && env.AGENT_PUBLIC_URL
      ? { registryUrl: env.AGENT_REGISTRY_URL, domainIntegrationKey: env.DOMAIN_INTEGRATION_KEY ?? "mediapulse",
          domainIntegrationApiKey: env.DOMAIN_INTEGRATION_API_KEY, agentUrl: env.AGENT_PUBLIC_URL }
      : undefined,
  },
);
```

Export default `{ port: env.PORT ?? 4004, fetch: app.fetch }`.

---

### Step 11 — Tests

**New test files**

| File | What to test |
|------|-------------|
| `agent-data-api/src/services/query-analysis.test.ts` | `getQueryAnalysisContext` (mock prisma — ticker not found, happy path); `persistQuerySet` (transaction rollback on error, one-active-set invariant) |
| `agent-data-api/src/routes/query-analysis.test.ts` | GET 400 (missing tickerId), GET 200, POST 400 (invalid body), POST 200 |
| `agents/query-analysis/src/deterministic-generator.test.ts` | Template expansion, dedup, min-count enforcement |
| `agents/query-analysis/src/query-ranker.test.ts` | Score ordering, intent weight application, size trimming, rank assignment |
| `agents/query-analysis/src/llm-generator.test.ts` | LLM parse failure returns `[]`; valid JSON returns typed array |
| `agents/query-analysis/src/index.test.ts` | LLM failure fallback (deterministic-only set persisted); full happy-path mock |
| `agent-runtime/src/hermes-invoke-correlation.test.ts` | Extend existing tests to cover `X-Job-Id` present / absent |

Use `vitest` with the `@workspace/` mock helpers already established in the codebase.

---

### Step 12 — Dev-docs update

**File to create**

`dev-docs/docs/query-analysis-agent.mdx`

Cover:
- Purpose and architecture diagram (agent → agent-data-api → DB)
- Local dev setup: env file, port, how to trigger manually via `curl`
- How `search_query_set.is_active` is managed (one active per ticker guarantee)
- Backfill note: existing flat `search_query` rows with `set_id IS NULL` are still served by
  data-collection via the `setId: null` fallback until the agent runs for that ticker
- `agentJobId` join path: `search_query_set.agent_job_id → agent_job_execution.job_id →
  schedule_execution → schedule`
- Observability: which structured-log fields to query for (`tickerId`, `setId`, `agentJobId`)
- Rollout checklist referencing the phases below

---

## Phase 2 — KG enrichment and metrics

### Step 13 — KG relation-delta enrichment on GET context

**Files to modify**

| Path |
|------|
| `packages/shared/agent-data-api-contract/src/query-analysis.ts` |
| `apps/mediapulse/agent-data-api/src/services/query-analysis.ts` |

**Contract**: add an optional field to `getQueryAnalysisResponseSchema`:

```typescript
recentRelationDeltas: z.array(z.object({
  fromEntity: z.string(),
  toEntity: z.string(),
  relationTypeName: z.string(),
  weight: z.number(),
  lastSeenAt: z.string().datetime(),
})).optional(),
```

**Service**: add a `getKgRelationDeltas(tickerId, cutoffDays = 7)` helper that queries
`EntityRelation` joined through `TickerEntity` to scope results to the ticker's entity graph,
ordered by `lastSeenAt` descending. Merge the result into `getQueryAnalysisContext`.

**Agent**: in `src/llm-generator.ts`, include `recentRelationDeltas` in the prompt context when
present so the model can generate `kg_change`-intent queries that reference actual recent relationship
changes (e.g. "Apple partnership Microsoft latest").

### Step 14 — Metrics and observability dashboard

- Emit structured log fields on every run: `queryCount`, `deterministicCount`, `llmCount`,
  `intentBreaking`, `intentKgChange`, `intentFundamental`, `isFallback` (true when LLM failed).
- Downstream yield (articles per query) can be tracked by joining
  `search_query → data_source → article_relevance.selected` in analytics queries; add the join
  SQL as a dev-docs query snippet.
- Hermes agent run history provides per-job success/failure tracking via `agent_job_execution`.

---

## Phase 3 — Tuning and per-ticker overrides

### Step 15 — Ranking and prompt tuning from production data

After the first weeks of production data:
- Analyse `rank` vs `data_source` count per query to identify under-performing intents.
- Adjust default weights in `env.agents.query-analysis.example` and in `ConfigSchema` defaults.
- Consider novelty scoring: compare current candidate texts against the previous N sets via a
  `SearchQuerySet` lookback query; penalise near-duplicate texts using normalised Levenshtein or
  token overlap.

### Step 16 — Per-ticker config (out of v1 scope, future)

- Extend `Ticker.metadata` or create a `TickerQueryConfig` join table.
- Update `getQueryAnalysisContext` to merge per-ticker overrides on top of global config.
- Surface per-ticker overrides as an admin edit panel in Hermes (requires `table-v1` `update: true`
  on a new resource, outside the `search-queries` read-only table).

---

## Implementation order and dependency graph

```
Step 1 (DB migration)
  └─► Step 2 (contract schemas)
        └─► Step 3 (manifest registration)
              ├─► Step 4 (API routes + service)   ← depends on Step 1 (Prisma models)
              │     └─► Step 5 (dataCollection fix)
              └─► Step 9 (agent scaffold)
                    └─► Step 10 (agent impl)       ← depends on Step 6 (env), Step 8 (runtime)

Step 6 (env keys)           — no blockers; can run in parallel with Steps 1–3
Step 7 (Hermes dashboard)   — depends on Step 1 (new Prisma fields)
Step 8 (agent-runtime)      — no blockers; can run in parallel with Steps 1–7
Step 11 (tests)             — after all implementation steps in respective package
Step 12 (dev-docs)          — after Phase 1 is complete
```

---

## Open decisions to resolve before / during implementation

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Active-set DB enforcement strategy | App-level atomic transaction (Steps 4 + `persistQuerySet`) is sufficient for v1; a partial unique index (`WHERE is_active = true`) can be added later if race conditions surface in production. |
| 2 | Migration strategy for existing flat `SearchQuery` rows | Use the `setId: null` fallback in `dataCollection.get` (Step 5) as a transitional measure; document the backfill script in dev-docs. |
| 3 | Novelty scoring across past sets | Phase 3; skip for v1. Use a simple dedup against the *current* run's candidates only. |
| 4 | Exact quality-filter thresholds (query min length, banned terms) | Start conservative: `text.trim().length >= 5`, no filtering beyond dedup. Add a configurable filter list in Phase 3. |
| 5 | `X-Job-Id` header alignment with Hermes worker | Verify the exact header name against `packages/hermes/scheduler/src/invoke-agent.ts` before merging Step 8; update `HERMES_HEADER_JOB_ID` if the name differs. |

---

## Acceptance criteria checklist

- [ ] Daily query-analysis run creates exactly one new active `SearchQuerySet` per ticker.
- [ ] `dataCollection.get` returns only queries from the active set (or legacy flat rows as fallback).
- [ ] Admin can change `QUERY_ANALYSIS_QUERY_COUNT` and `QUERY_ANALYSIS_ALLOWED_LANGUAGES` in Hermes
      without a code deploy.
- [ ] Each `SearchQuery` row carries `source`, `intent`, and `rank`.
- [ ] `SearchQuerySet.strategy_snapshot` records the full config in use at generation time.
- [ ] On LLM failure, deterministic-only set is still persisted and activated.
- [ ] Hermes Search Queries table shows all 13 non-id columns from the PRD target table.
- [ ] `SearchQuerySet.agent_job_id` is populated for scheduled runs and null for manual/test runs.
- [ ] Historical sets are queryable and not returned by `dataCollection.get`.
- [ ] All new code has passing unit tests; no existing tests regress.