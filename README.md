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

Optional, non-deterministic AI commentary (requires `OPENAI_API_KEY`, and in CI `OPENAI_MODEL` if you want to override the default):

```bash
CURSOR_REVIEW_BASE_SHA="$(git merge-base origin/main HEAD)" \
CURSOR_REVIEW_HEAD_SHA="$(git rev-parse HEAD)" \
pnpm ai:review
```
