# MediaPulse Developer Docs

This folder is the **content root** for [Speed Docs](https://speed-docs.dev). It contains MDX pages and `meta.json` for navigation. The generated static site documents apps and packages in the MediaPulse monorepo.

## Commands

**Development** (hot reload):

```bash
pnpm dlx speed-docs --dev ./dev-docs
```

**Production build**:

```bash
pnpm dlx speed-docs ./dev-docs
```

Output is written to the **`docs-output`** directory at the repository root. To preview the built site:

```bash
pnpm dlx serve@latest docs-output
```

## Structure

- `config.json` — Site title and optional logo.
- `docs/` — All documentation pages (MDX) and folder-level `meta.json` for sidebar order.
- Top-level nav: **Overview**, **Hermes**, **Mediapulse**, **Hermes–Mediapulse integration**, **Shared**, **Guide** (development and production). Hermes and Mediapulse each use **Apps** and **Packages** in the sidebar; Mediapulse includes **Knowledge graph**; `root: true` in `meta.json` marks top-level sections.
- See the [create-project-docs](../.cursor/skills/create-project-docs/SKILL.md) skill for content conventions and available MDX components.

## Related

- Root [README](../README.md) — How to run the apps and set up the project.
- [Hermes and Mediapulse domains](docs/integration/domains.mdx) — Two-domain map; [communication](docs/integration/communication.mdx) for cross-service flows.
