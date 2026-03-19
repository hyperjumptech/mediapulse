# KG-AGENTS-03: Query-Analysis Agent LLM Logic

## Type

Feature

## Priority

High

## Description

Implement the core `run()` function of the query-analysis agent. It reads KG context from `agent-data-api`, constructs an LLM prompt, generates 8 search query strings, and writes them back.

## Acceptance criteria

- [ ] Agent `run()` calls `GET /api/query-analysis?tickerId=...` to fetch context
- [ ] LLM prompt includes ticker metadata (symbol, name, sector, industry)
- [ ] LLM prompt includes top KG entities when available (warm mode)
- [ ] LLM prompt includes recent article themes when available (warm mode)
- [ ] Cold-start mode works with only ticker metadata (empty KG)
- [ ] LLM generates exactly 8 search queries as JSON structured output
- [ ] Queries are a mix of Indonesian and English
- [ ] Agent posts generated queries to `POST /api/query-analysis`
- [ ] OpenAI client uses DI (accept as parameter with production default)
- [ ] `dataApiGet`/`dataApiPost` helpers used for API communication
- [ ] Unit tests with 100% coverage using fake OpenAI client and fake API responses
- [ ] `pnpm code-quality` passes

## LLM prompt design

### System prompt

```
You are a financial news research assistant for the Indonesian stock market (IDX).

Your job: generate search query strings that will find the most relevant, recent news articles about a specific ticker and its business context.

Rules:
- Generate exactly 8 query strings.
- Each query should target a different angle (company-specific news, sector trends, key people, competitors, regulatory, earnings/financials, partnerships/deals, market sentiment).
- Use a mix of Indonesian and English queries, since Indonesian financial news appears in both languages.
- Include the ticker symbol or company name in most queries for precision.
- Queries should be optimized for Google News search (short, keyword-rich, no boolean operators).
- Prefer recent/time-sensitive angles (earnings, quarterly results, recent deals) over evergreen content.
- Return a JSON array of objects: [{ "text": "query string", "angle": "brief label" }]
```

### User prompt (cold start)

```
Generate search queries for this IDX-listed company:

Ticker: {symbol}
Company: {name}
Sector: {metadata.Sektor}
Industry: {metadata.Industri}
Sub-industry: {metadata.SubIndustri}
Business: {metadata.KegiatanUsahaUtama}

There is no prior knowledge graph for this ticker yet. Generate broad discovery queries
that will help us learn about the company's current activities, key people, subsidiaries,
competitors, and recent developments.
```

### User prompt (warm — has KG context)

```
Generate search queries for this IDX-listed company:

Ticker: {symbol}
Company: {name}
Sector: {metadata.Sektor}
Industry: {metadata.Industri}

Known entities in this ticker's knowledge graph (most relevant first):
{topEntities formatted as "- {canonicalName} ({typeName})" list}

Recent article themes from past 7 days:
{recentThemes formatted as "- {theme} (appeared in {articleCount} articles)" list}

Generate queries that:
1. Track ongoing stories from the themes above.
2. Discover NEW developments not yet in the knowledge graph.
3. Cover the company's key entities and relationships.
```

## Response parsing

Use `response_format: { type: "json_object" }` with OpenAI. Parse the response with Zod:

```typescript
const queryResponseSchema = z.object({
  queries: z
    .array(
      z.object({
        text: z.string(),
        angle: z.string(),
      }),
    )
    .min(1)
    .max(15),
});
```

Extract only `text` for the SearchQuery records. The `angle` field is logged for observability but not stored.

## Files to modify

- `apps/agents/query-analysis/src/run.ts` (main logic)
- `apps/agents/query-analysis/src/run.test.ts` (tests)
- `apps/agents/query-analysis/src/index.ts` (wire run into agent app)

## Files to create

- `apps/agents/query-analysis/src/build-prompt.ts` (prompt construction, testable)
- `apps/agents/query-analysis/src/build-prompt.test.ts`
- `apps/agents/query-analysis/src/parse-query-response.ts` (Zod parsing)
- `apps/agents/query-analysis/src/parse-query-response.test.ts`

## Dependencies

- KG-AGENTS-01 (scaffold must exist)
- KG-AGENTS-02 (API routes must exist)
