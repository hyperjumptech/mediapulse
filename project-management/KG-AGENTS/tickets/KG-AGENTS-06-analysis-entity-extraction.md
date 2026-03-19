# KG-AGENTS-06: Analysis Agent — Entity Extraction Logic

## Type

Feature

## Priority

High

## Description

Implement the entity extraction step of the analysis agent. For each unanalyzed article, call the LLM with structured output to extract entities and relationships, using the admin-defined EntityType and RelationType vocabularies.

## Acceptance criteria

- [ ] Agent reads unanalyzed articles + vocabularies from `GET /api/analysis`
- [ ] LLM prompt dynamically injects EntityType names and descriptions from the DB
- [ ] LLM prompt dynamically injects RelationType names and descriptions from the DB
- [ ] LLM extracts entities with: name, type (from vocabulary), aliases[], description
- [ ] LLM extracts relationships with: from entity, to entity, relationType (from vocabulary)
- [ ] Articles are batched (e.g. 3-5 per LLM call) to reduce API calls
- [ ] Response parsed with Zod structured output schema
- [ ] Graceful handling: if LLM returns an entity type not in the vocabulary, skip that entity and log a warning
- [ ] OpenAI client uses DI for testing
- [ ] Unit tests with 100% coverage using fake LLM responses
- [ ] `pnpm code-quality` passes

## LLM prompt design

### System prompt

```
You are a financial news entity extraction system. Given a news article, extract
all named entities and relationships between them.

Entity types (use ONLY these):
{entityTypes.map(t => `- ${t.name}: ${t.description}`).join('\n')}

Relationship types (use ONLY these):
{relationTypes.map(t => `- ${t.name}: ${t.description}`).join('\n')}

For each entity, provide:
- name: the most common/canonical name used in the article
- type: one of the entity types listed above
- aliases: other names, abbreviations, or ticker symbols used in the article
- description: one-sentence description based on context

For each relationship, provide:
- from: name of the source entity (must match an extracted entity name)
- to: name of the target entity (must match an extracted entity name)
- relationType: one of the relationship types listed above

Return JSON: { "entities": [...], "relations": [...] }
```

### User prompt

```
Extract entities and relationships from this article:

Title: {article.title}
Source: {article.url}
Content: {article.content (truncated to ~4000 chars if needed)}
```

## Response schema (Zod)

```typescript
const extractionResponseSchema = z.object({
  entities: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      aliases: z.array(z.string()).default([]),
      description: z.string().optional(),
    }),
  ),
  relations: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      relationType: z.string(),
    }),
  ),
});
```

## Batching strategy

- Group articles in batches of 3-5
- For each batch, include all articles in a single LLM call with clear separators
- If a batch fails, retry individual articles from that batch
- Log token usage per batch for cost monitoring

## Files to create

- `apps/agents/analysis/src/extract-entities.ts`
- `apps/agents/analysis/src/extract-entities.test.ts`
- `apps/agents/analysis/src/build-extraction-prompt.ts`
- `apps/agents/analysis/src/build-extraction-prompt.test.ts`

## Dependencies

- KG-AGENTS-04 (scaffold)
- KG-AGENTS-05 (API routes)
- KG-DATA-03 (seed data for EntityType/RelationType)
