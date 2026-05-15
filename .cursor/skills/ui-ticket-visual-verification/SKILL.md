---
name: ui-ticket-visual-verification
description: >-
  Produces owner-ready visual verification for UI/UX ticket work: isolate the changed surface
  behind dev-only fixtures, mock external data, add reproducible simulate scripts, and capture
  screenshots or short screen recordings using browser tools. Use when implementing GitHub issues,
  product tickets, or PRs that change Hermes/Mediapulse UI, flows, modals, forms, or layout; when
  the user asks for screenshots, video proof, demo pages, or a way to replay what the agent verified.
---

# UI ticket visual verification (Mediapulse / Hermes)

## Repo integration

The project rule **`.cursor/rules/ui-ticket-visual-verification.mdc`** applies while editing **`apps/**/_.tsx`** or **`apps/\*\*/_.css`\*\*. Treat that as a signal to follow this skill for user-visible changes, especially when the task references an issue or ticket.

## When to use

Apply this skill whenever ticket work is **primarily UI/UX** (pages, components, client flows, styling, copy placement, modals, empty states). Skip heavy visual evidence for purely non-visual changes (types-only refactors, API-only changes with no UI contract shift) unless the ticket explicitly asks for UI proof.

## Outcomes (always ship these together)

1. **Isolation** — A path to view the ticket’s UI without walking the full production graph (fixture route, story-style page, query-driven demo state, or focused package dev server).
2. **Mocks / stubs** — Scripts or small modules that fake APIs, webhooks, auth, inventory, or other backends the ticket does not own. Prefer explicit fixtures over mutating shared dev databases.
3. **Repro script** — One entry point (e.g. `pnpm` script or `bash`/`tsx` under the touched app) that documents env vars, starts the minimal server, and states the URL to open. Devs must replay the same view the agent used.
4. **Evidence** — At least one **screenshot** of the final state; add a **short video** only when motion, transitions, or multi-step interaction matters. Store artifacts under a **gitignored** path (see below) and **link or attach** them in the PR / ticket comment.

## Isolation strategy (pick the smallest that proves the ticket)

Prefer, in order:

1. **Dev-only fixture route or page** — Renders only the component or flow under test with props or loader data wired to a fixture (search existing patterns: `fixture`, `demo`, `dev-only`, `preview` in the target app before inventing a new convention).
2. **Query- or flag-driven state** — Same page as production, but `?uiFixture=sold-out` (or similar) switches mocked loaders / server data. Gate parsing so defaults stay unchanged for real users.
3. **Package-scoped dev server** — Run the relevant Next (or other) app via workspace filter, e.g. from repo root: `pnpm dev:hermes`, `pnpm dev:user-registration`, or `pnpm --filter <package> dev` when no root alias exists.
4. **Full journey** — Only if the ticket truly requires cross-service state; then automate setup in the repro script (create user, sign in, seed) and still prefer **background mutation via API/fixture** over manual DB surgery.

For tickets like **“warning modal when Add to cart on sold-out item”**, do **not** default to a long manual E2E. Instead: render the product page or cart button **with a fixture** where stock is already zero, or toggle stock via a dev-only API handler / mock used only by the fixture route—then click once and capture the modal.

## Mocks and data

- **Third-party / HTTP** — MSW handlers, Next `rewrites` to a local stub route, or a tiny in-repo mock server if the team already uses that pattern. Document required env in the app’s `env.example` only when adding **new** variables (follow `@mediapulse/env` / `@hermes/env` rules elsewhere in the repo).
- **Never** commit secrets or real customer data into fixtures.
- **Production safety** — Fixture routes and mock endpoints must be unreachable in production builds (compile-time removal, `NODE_ENV === "development"` guards, feature flags, or static analysis the app already uses).

## Browser capture workflow

Use the **Cursor IDE browser** tools when available:

1. List tabs; navigate to the fixture URL on the local dev server.
2. Take a **snapshot** before interactions; interact (click, open modal); snapshot again.
3. Use **screenshot** for static proof; use **video** only when the ticket needs motion (animation, toast timing, drag). If the browser tool cannot record video, use a one-line note in the PR telling reviewers to run the repro script and record locally, or add an optional Playwright/Vitest browser script if the package already supports it.

Save files under something like `artifacts/ui-evidence/<ticket-or-branch-slug>/` and ensure that path is **gitignored** (or use PR attachments only). Do not rely on binary blobs living in git unless the team already commits golden images.

## Repro script contract

Each script or `package.json` script entry should:

- State **prerequisites** (Node version, `pnpm i`, Docker if any).
- Export or echo the **exact URL** (including port and query string).
- Be **idempotent** — safe to run twice without duplicating users or dirtying shared state when avoidable.

## Handoff text for PRs / tickets

Include a short block:

- What was isolated (route + fixture name).
- Command to run the repro.
- Where screenshots/video live (path or “attached below”).
- Anything still validated only in full staging (if anything).

## Further patterns

See [reference.md](reference.md) for a isolation ladder summary, artifact layout, and narrative examples aligned with this monorepo’s `pnpm` / Turbo layout.
