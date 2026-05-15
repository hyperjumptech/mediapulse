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

## Hard rules (visual proof integrity)

These are non-negotiable. Violating them invalidates the PR/ticket handoff.

- **NEVER** commit or push placeholder, blank, 1×1, solid-color, generated-fake, or otherwise empty images as visual proof — this includes minimal valid PNGs created only to satisfy a link.
- **NEVER** push to `issue-proofs` or paste image links into PR bodies or ticket comments until every screenshot passes **all** of the following gates:
  - Dimensions: **≥ 800 px** on both width and height.
  - File size: **≥ 20 KB**.
  - Legible UI text, labels, and/or interactive fields are visible in the frame.
- If browser capture, Hermes auth, or local dev is blocked, **stop and report the blocker immediately**. Do **not** substitute fake proof of any kind. Document repro-only steps in a README next to the fixture until a real capture is possible — but keep the todo open.
- **Before** `orphan-branch-store.sh` (or any commit of proof images), **open or inspect** each file and verify: dimensions (`sips -g pixelWidth -g pixelHeight <file>` or equivalent), file size ≥ 20 KB, and that labels/fields are legible.
- When a plan, ticket, or PR requires visual verification, marking that work **complete** without real, gate-passing images is **forbidden**.

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

Save files under something like `artifacts/ui-evidence/<ticket-or-branch-slug>/` and ensure that path is **gitignored** (or use PR attachments only). Do not rely on binary blobs living in git unless the team already commits golden images. Put **repro notes, ticket link, and capture commands** in a **`README.md` next to the dev fixture** (e.g. `app/dev/ui/<issue>/README.md`) instead of the app’s top-level `README.md`.

After capture, run a mandatory sanity check on each PNG before `orphan-branch-store.sh --push issue-proofs`: confirm dimensions are **≥ 800 × 800 px** and file size is **≥ 20 KB**. If either check fails, re-capture — do not push.

## Repro script contract

Each script or `package.json` script entry should:

- State **prerequisites** (Node version, `pnpm i`, Docker if any).
- Export or echo the **exact URL** (including port and query string).
- Be **idempotent** — safe to run twice without duplicating users or dirtying shared state when avoidable.

## Handoff text for PRs / tickets

Include a short block:

- What was isolated (route + fixture name).
- Command to run the repro.
- **Embed screenshots inline** in the PR or issue body so GitHub renders them — do not use link-only lists.
- Anything still validated only in full staging (if anything).

### Embed images in PR bodies (required)

GitHub does **not** render `blob/...` page links as images. Use **markdown image syntax** with a **raw** URL:

```markdown
![article-analysis SchemaForm — prompts fields](https://raw.githubusercontent.com/<org>/<repo>/issue-proofs/<path>/screenshot.png)
```

After `orphan-branch-store.sh --push issue-proofs`, build URLs as:

`https://raw.githubusercontent.com/<org>/<repo>/issue-proofs/<dest-path>`

Optional: add a collapsible `<details>` block for repro steps; keep the **image above the fold** in the Visual verification section.

**Forbidden:** bullet lists of text links only (e.g. `[SchemaForm](https://github.com/.../blob/...png)`) with no `![...](raw...)` embeds.

## Pre-handoff checklist (required when visual proof is in scope)

Run every item before marking visual-verification work complete or opening/updating a PR:

1. **Capture** — Real UI in browser (or approved dev fixture using the same `SchemaForm` / component Hermes uses). No synthesized “valid PNG” files.
2. **Gate** — Each PNG: ≥ 800×800 px, ≥ 20 KB, legible labels/fields (`sips -g pixelWidth -g pixelHeight` or PIL).
3. **Archive** — Push to `issue-proofs` only after gates pass (`orphan-branch-store.sh --push`).
4. **Embed** — PR body uses `![caption](https://raw.githubusercontent.com/<org>/<repo>/issue-proofs/...)` for **this layer’s** screenshot(s). Re-run `gh pr edit --body-file` after captures exist.
5. **Verify render** — `gh pr view <n> --json body` contains `![` + `raw.githubusercontent.com`; spot-check the PR in the browser — images must show inline, not dead links.
6. **Stack** — Each stacked PR embeds proof for **its** UI change; do not mark the stack’s visual todo done from layer 1 alone unless the plan says one shared proof block on the final PR only.
7. **CI hygiene** — Root `pnpm format:check` before push (visual work still touches TS/MD often).
8. **Blockers** — If Hermes/env/auth blocks capture: report blocker, leave todo **open**, no fake images.

## Anti-patterns (never repeat)

| Mistake | Why it fails | Do instead |
| ------- | ------------ | ---------- |
| 1×1 / blank / solid-color PNG on `issue-proofs` | Reviewers see empty images; violates trust | Real browser screenshot; stop if blocked |
| `[label](https://github.com/.../blob/...png)` only | GitHub does not render `blob` links as images | `![label](https://raw.githubusercontent.com/.../path.png)` |
| Marking visual todo complete without embeds | Plan/AC not met | Keep todo open until PR shows inline images |
| Separate `chore/*` branch for stack-related rules/docs | Extra PR noise; stack already carries the feature | Commit guidance on **bottom stack branch** (layer 1) or final layer |
| Pushing feature branch before `pnpm format:check` | CI “Code quality” fails on Prettier | Run format check (or `pnpm format`) at repo root before push |
| Editing imports in `run.ts` without re-running agent tests | Broken production path (e.g. dropped `env` import) | Run package `pnpm vitest run` for touched agents |
| Delegating capture to a subagent then shipping without verifying output | Subagent may hit env errors or skip work | Parent verifies local artifacts + PR body before handoff |

## Further patterns

See [reference.md](reference.md) for isolation ladder, artifact layout, PR embed examples, and narrative patterns aligned with this monorepo’s `pnpm` / Turbo layout.
