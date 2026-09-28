# Agent guide

This file is for coding agents (Claude Code, Cursor, Codex and others) working in this repo. Humans should start with `README.md` and the dev-docs (`pnpm docs:dev`).

## What lives where

The monorepo holds two products and the code they share.

| Path                    | What it is                                                                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/hermes/*`         | Hermes, a generic pipeline orchestrator: `dashboard` (Next.js admin UI on :3001), `worker`, `agent-auth-api` (:8080), `agent-registry-api` |
| `packages/hermes/*`     | Hermes internals: `domain-contract`, `orchestration-database`, `scheduler`, `mcp-server`, `env`                                            |
| `apps/mediapulse/*`     | Mediapulse, the newsletter product: `domain-api` (:8090), `agents/*`, `user-registration`                                                  |
| `packages/mediapulse/*` | Mediapulse internals: `database`, `env`, `hermes-integration`                                                                              |
| `packages/shared/*`     | Shared code: `ui` (shadcn kit, `@workspace/ui`), `agent-runtime`, `email-templates`, `logger` and others                                   |

**Hermes stays domain-agnostic.** Never put Mediapulse words (tickers, newsletters, Serper, agent names) into `apps/hermes` or `packages/hermes`. Domain pages reach Hermes through the manifest contract in `packages/hermes/domain-contract`; the Mediapulse side of that contract lives in `apps/mediapulse/domain-api/src/resources/*/dashboard-page.ts`.

## Commands

| Task                    | Command                                                |
| ----------------------- | ------------------------------------------------------ |
| Full gate before a PR   | `pnpm code-quality`                                    |
| One package             | `pnpm --filter <package> lint`, `type:check`, `test`   |
| Format                  | `pnpm format` (Prettier)                               |
| Diff-scoped rule checks | `pnpm cursor:review -- --base origin/main --head HEAD` |
| Agent config links      | `pnpm check:agent-config`                              |
| Hermes domain words     | `pnpm check:hermes-domain`                             |
| Hermes dashboard        | `pnpm dev:hermes`                                      |
| Dashboard screenshots   | `pnpm --filter @hermes/dashboard visual:capture`       |
| Dashboard route timings | `pnpm --filter @hermes/dashboard measure:timings`      |

Local end-to-end needs Postgres (`docker-compose up -d`), the dashboard, `agent-auth-api` and, for domain pages, `domain-api`.

## Code conventions

- **No code comments.** No JSDoc and no inline `//` explanations. Use descriptive names; put the reasoning in the commit message or PR body.
- **File names are kebab-case**, except Next.js routing files and `route.<method>.config.ts`.
- **React state lives in hooks.** Components never call `useState` or `useEffect` directly; put them in `hooks/use-*.ts`. CI (`cursor-review`) fails otherwise.
- **Env comes from `@hermes/env` or `@mediapulse/env`**, never `process.env`. Add variables with the `env-variables` skill.
- **Tests are co-located** (`*.test.ts(x)`) and use Vitest. Prefer dependency injection over mocks.
- **shadcn components come from the CLI.** Run `npx shadcn@latest add <name>` from `apps/hermes/dashboard`; it writes into `@workspace/ui`. Never hand-write a shadcn primitive or block. The shadcn MCP server in `.mcp.json` can search the registry.
- **Dates in the Hermes dashboard** render through `components/date-time/date-time.tsx`, in the viewer's time zone.
- **Reuse before you create.** `.cursor/rules/reuse-before-create.mdc` lists the shared dashboard components.

## Pull requests

- Open PRs with the `open-github-pr` skill. It creates and links a GitHub issue first and runs `pnpm code-quality`.
- Ship a series as sequential PRs, each branched from `main` after the previous one merges. Stacked PRs get no CI checks.
- The repo has no required status checks, so `gh pr merge --auto` merges immediately. Watch CI (the `pr-check-monitor` agent does this) and merge by hand once it is green.
- UI changes need screenshots: follow the `ui-ticket-visual-verification` skill.

## Rules, skills and agents

- Skills: `.cursor/skills/<name>/SKILL.md`. Claude Code reads the same files through the `.claude/skills` symlink.
- Subagents: `.cursor/agents/` (`verifier`, `pr-check-monitor`), linked as `.claude/agents`.
- Cursor rules: `.cursor/rules/*.mdc`. Other tools should read the ones that match the files they edit, starting with `typescript-javascript-standards.mdc`, `react-custom-hooks.mdc`, `hermes-domain-separation.mdc` and `reuse-before-create.mdc`.
- MCP servers (`.mcp.json`, mirrored in `.cursor/mcp.json`): `shadcn`, and `hermes`, which reads `HERMES_MCP_PROFILE_<NAME>_BASE_URL` and `HERMES_MCP_PROFILE_<NAME>_API_KEY` from your shell.
