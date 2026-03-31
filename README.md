# MediaPulse

## Quick start

**Prerequisites:** Node.js 22+, pnpm 10.4+, Docker. Use pnpm for install/scripts.

```bash
docker-compose up -d
./dev-setup-local.sh
pnpm dev
```

Then open **http://localhost:3001**.

The setup script is interactive: it will prompt for admin email/password and bootstrap env, DB migrations, admin user, and API keys.

## More information

Full setup options, services and ports, third-party API keys, troubleshooting, and running individual apps are in the **dev-docs**. From the repo root:

```bash
pnpm docs:dev
```

Then open the docs and go to **Getting started**.

## Pull request checks (Cursor rules)

Before opening a PR, run the workspace gate (type-check, lint, tests, format) locally:

```bash
pnpm code-quality
```

For a fast, diff-scoped check against `.cursor/rules` (kebab-case filenames, `process.env`, Prisma/migration heuristics, etc.):

```bash
pnpm cursor:review -- --base origin/main --head HEAD
```

To review an arbitrary PR, pass that PR’s `baseRefOid` / `headRefOid` from `gh pr view <n> --json baseRefOid,headRefOid`, then `git fetch` so those commits exist locally. File contents are read from **`git show <head>:path`**, so your working tree does not need to be checked out to the PR branch.

**`cursor:review` notes**

- Files under repo-root **`scripts/`** are exempt from the **`process.env`** check (CLI tooling may read env directly; app/package code under `packages/.../scripts/` is still checked).
- To skip a deterministic rule for a specific file, add a directive in the **first 40 lines** (after an optional shebang on line 1):
  - **TypeScript/JavaScript:** `// cursor-pr-review-disable: <rule-id>[, ...]` or a one-line block `/* cursor-pr-review-disable: all */`.
  - **SQL** (paths ending in `.sql`): `-- cursor-pr-review-disable: <rule-id>[, ...]`.
- Rule ids: `env-variables`, `typescript-javascript-standards`, `react-custom-hooks`, `prisma-migrations`, `prisma-strong-typing`. Use `all` to disable every check for that file.

Optional, non-deterministic AI commentary (requires `OPENAI_API_KEY`, and in CI `OPENAI_MODEL` if you want to override the default):

```bash
CURSOR_REVIEW_BASE_SHA="$(git merge-base origin/main HEAD)" \
CURSOR_REVIEW_HEAD_SHA="$(git rev-parse HEAD)" \
pnpm ai:review
```
