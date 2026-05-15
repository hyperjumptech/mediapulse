# Hermes SchemaForm visual proof (#478–482)

Real browser captures of `@workspace/json-schema-form` (same component as Hermes **Agent configs** → **Config**) showing optional `prompts` fields with titles and descriptions from Zod `.describe()` where present.

| Issue | Agent | Screenshot |
| ----- | ----- | ---------- |
| #478 | `article-analysis@1.0.0` | [478-article-analysis-schemaform.png](./478-article-analysis-schemaform.png) |
| #480 | `query-analysis@1.0.0` | [480-query-analysis-schemaform.png](./480-query-analysis-schemaform.png) |
| #481 | `content-generation@1.0.0` | [481-content-generation-schemaform.png](./481-content-generation-schemaform.png) |

Captured dimensions: **1902×1248** px each (~110 KB PNG). Method: Cursor browser screenshot of dev fixture (May 2026).

## Repro (dev fixture)

From repo root, export config JSON Schema from each feature branch (same shape as agent `GET /schemas`):

```bash
SCHEMA_DIR=apps/hermes/dashboard/app/dev/ui/mp-agent-prompts-hermes/schemas
mkdir -p "$SCHEMA_DIR"

git checkout issue-478-479-article-analysis-prompts
pnpm exec tsx apps/hermes/dashboard/scripts/export-mp-agent-prompts-config-schema.ts article-analysis "$SCHEMA_DIR"

git checkout issue-480-query-analysis-prompts
pnpm exec tsx apps/hermes/dashboard/scripts/export-mp-agent-prompts-config-schema.ts query-analysis "$SCHEMA_DIR"

git checkout issue-481-content-generation-prompt-hardening
pnpm exec tsx apps/hermes/dashboard/scripts/export-mp-agent-prompts-config-schema.ts content-generation "$SCHEMA_DIR"
```

Start Hermes (requires local env; see root `README.md` for Docker DB):

```bash
pnpm dev:hermes
```

Open (development only; returns 404 in production):

- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=article-analysis
- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=query-analysis
- http://localhost:3001/dev/ui/mp-agent-prompts-hermes?agent=content-generation

Scroll to **Prompts** and capture a screenshot. Save under `artifacts/ui-evidence/mp-agent-prompts-hermes/`, then push with:

```bash
.cursor/skills/orphan-branch-file-storage/scripts/orphan-branch-store.sh \
  -m "Visual proof: mp-agent-prompts Hermes SchemaForm (#478-482)" \
  --push issue-proofs -- \
  artifacts/ui-evidence/mp-agent-prompts-hermes/478-article-analysis-schemaform.png=mp-agent-prompts-hermes/478-article-analysis-schemaform.png \
  artifacts/ui-evidence/mp-agent-prompts-hermes/480-query-analysis-schemaform.png=mp-agent-prompts-hermes/480-query-analysis-schemaform.png \
  artifacts/ui-evidence/mp-agent-prompts-hermes/481-content-generation-schemaform.png=mp-agent-prompts-hermes/481-content-generation-schemaform.png \
  artifacts/ui-evidence/mp-agent-prompts-hermes/issue-proofs-README.md=mp-agent-prompts-hermes/README.md
```

## Production path (no fixture)

With orchestration DB seeded and agents registered: **Dashboard → Agent configs →** add or edit → select agent → **Config** (SchemaForm with variable expansion on string fields).
