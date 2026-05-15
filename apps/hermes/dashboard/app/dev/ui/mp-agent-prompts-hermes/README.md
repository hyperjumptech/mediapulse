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

Use **`focus=prompts`** so the screenshot shows only the prompt textareas (not the full 30+ field config):

- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=article-analysis&focus=prompts
- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=query-analysis&focus=prompts
- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=content-generation&focus=prompts

Automated capture (waits for two `<textarea>` elements, then screenshots the prompts panel):

```bash
pnpm --filter @hermes/dashboard exec node scripts/capture-mp-agent-prompts-screenshots.mjs
```

Requires `playwright` on the machine (`npx playwright install chromium` once). Save output under `artifacts/ui-evidence/mp-agent-prompts-hermes/`.

## Production alternative

With Docker + seeded orchestration DB: **Agent configs** → add/edit → select the agent → scroll to **prompts** in **Config** (same SchemaForm; string fields may use variable expansion).
