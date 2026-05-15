# mp-agent-prompts Hermes SchemaForm (dev fixture)

Dev-only pages for visual proof of optional `prompts` fields in agent config JSON Schema.

## Export schemas (per feature branch)

From repo root, on the branch that owns the schema:

```bash
pnpm exec tsx apps/hermes/dashboard/scripts/export-mp-agent-prompts-config-schema.ts article-analysis \
  apps/hermes/dashboard/app/dev/ui/mp-agent-prompts-hermes/schemas
```

Repeat after checking out:

- `issue-478-479-article-analysis-prompts` → `article-analysis`
- `issue-480-query-analysis-prompts` → `query-analysis`
- `issue-481-content-generation-prompt-hardening` → `content-generation`

## Capture

```bash
pnpm dev:hermes
```

Open (development only):

- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=article-analysis
- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=query-analysis
- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=content-generation

Scroll to the **prompts** section; confirm field titles, descriptions (from Zod `.describe()`), and string inputs. Save screenshots to `artifacts/ui-evidence/mp-agent-prompts-hermes/`.

## Production alternative

With Docker + seeded orchestration DB: **Agent configs** → add/edit → select the agent → **Config** section (same SchemaForm, with variable expansion on string fields).
