# Data collection agent

Collects web sources for a ticker through one linear pipeline:

```
get queries → search → fetch → filter → save  (repeat until the daily target)
```

Search and fetch each run over a round-robin pool of providers (Serper, Tavily, Exa) with
failover. The filter drops duplicates, thin content, and stale pages cheaply, then judges
relevance with an LLM against the agent contract brief (falling back to keyword matching).
Results are persisted to the Agent Data API.

## Configuration

An empty `{}` validates into the recommended end-to-end setup; override only what you need.

### Hermes variables

Create these variables in Hermes so placeholder defaults resolve at run time:

| Variable         | Used for                                        |
| ---------------- | ----------------------------------------------- |
| `SERPER_API_KEY` | Serper search and fetch provider                |
| `TAVILY_API_KEY` | Tavily search and fetch provider                |
| `EXA_API_KEY`    | Exa search and fetch provider                   |
| `AI_API_KEY`     | LLM relevance filter (OpenAI-compatible key)    |
| `AI_MODEL`       | LLM relevance filter model id                   |
| `AI_BASE_URL`    | LLM relevance filter base URL (e.g. OpenRouter) |

If a variable is missing, the literal `{{NAME}}` is passed through and the affected provider
fails with a clear auth error.

### Sections

1. **web_search** — round-robin search provider pool (`{ provider, apiKey }` entries).
2. **web_search_locales** — `{ gl, hl }` locales the query fans out across. gl/hl steer Serper,
   map to Tavily's country, and are ignored by Exa.
3. **web_fetch** — round-robin fetch provider pool (`{ provider, apiKey }` entries).
4. **relevance** — LLM filter credentials (`apiKey`, `model`, optional `baseUrl`).
5. **collection** — `targetSavedSources` (default 15) and `maxRounds` (default 3) for the repeat loop.

Freshness (7-day window), the dead-URL cache, and the per-host error breaker are always on with
internal defaults and have no config knobs.

### Example

Saving `{}` runs the recommended pipeline. To search an extra country and lower the daily target:

```json
{
  "web_search_locales": [
    { "gl": "id", "hl": "id" },
    { "gl": "us", "hl": "en" }
  ],
  "collection": { "targetSavedSources": 8 }
}
```

See `config.example.jsonc` for the full default shape with placeholders.

### Breaking change

The previous config surface (`providers`, `gates`, `resilience`, `runPolicy`, per-provider transport
knobs) is no longer accepted. Stored configs must be re-saved against the new schema; unknown keys are
stripped by Zod and fall back to defaults.
