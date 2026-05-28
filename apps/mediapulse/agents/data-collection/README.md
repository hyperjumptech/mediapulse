# Data collection agent

Collects web sources for a ticker by running Serper search, fetching pages through an ordered provider chain, applying quality and relevance gates, and persisting results to the Agent Data API.

## Configuration

The agent config is grouped for the Hermes step form. An empty `{}` validates into the recommended end-to-end setup; override only the sections you need.

### Hermes variables

Create these variables in Hermes so placeholder defaults resolve at run time:

| Variable            | Used for                                  |
| ------------------- | ----------------------------------------- |
| `SERPER_API_KEY`    | Web search (`providers.search`)           |
| `DIFFBOT_API_KEY`   | Primary fetch provider                    |
| `FIRECRAWL_API_KEY` | Secondary fetch provider                  |
| `JINA_API_KEY`      | Tertiary fetch provider                   |
| `OPENAI_API_KEY`    | Semantic dedupe embeddings (when enabled) |
| `EMBEDDING_MODEL`   | Embedding model name for semantic dedupe  |

If a variable is missing, the literal `{{NAME}}` is passed through and the affected stage fails with a clear provider auth error.

### Group overview

1. **providers** — Serper search settings and the ordered fetch chain (`diffbot` → `firecrawl` → `jina` by default).
2. **collection** — Daily target, refill rounds, and per-query/per-run fetch budgets.
3. **gates** — Relevance and freshness filters before persistence.
4. **resilience** — Dead-URL cache and per-host error breaker.
5. **deduplication** — Optional semantic dedupe against recent corpus fingerprints.
6. **runPolicy** — Minimum successful sources and zero-success failure behavior.

### Example

Saving `{}` in Hermes runs the recommended pipeline. To tighten only the run budget:

```json
{
  "collection": {
    "perRunFetchBudget": 20
  }
}
```

See `config.example.jsonc` for the full default shape with placeholders.

### Breaking change

The previous flat config keys (`webSearch`, `webFetch`, top-level gate fields, and so on) are no longer accepted. At invoke time, Zod strips unknown keys and applies defaults. When you save in Hermes, unknown keys are dropped to match the grouped JSON Schema (same as the form); re-enter any custom tuning in the grouped form or create a new saved config.
