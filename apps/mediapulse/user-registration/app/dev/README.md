# Dev-only routes (`app/dev`)

This tree holds **development-only** Next.js App Router pages (fixtures, UI previews). Routes are gated in code (for example `env.NODE_ENV !== "development"` → `notFound()`), so they are not meant for production traffic.

Each fixture folder may include a **co-located `README.md`** with the URL, env prerequisites, and how to capture screenshots or short video for tickets.

Keep ticket-specific repro notes **here or in PR/issue text**, not in the app’s top-level `README.md`, so that file stays stable as more tickets land.
