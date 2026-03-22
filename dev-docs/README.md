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
- Top-level nav: **Overview**, **Architecture** (domains, Hermes–domain integration, communication), **Guide** (development, production, agent–Hermes contract, data source expansion, integrate domain), **Shared** (e.g. `@workspace/ui`), then **Hermes** and **Mediapulse** (each with **Apps** and **Packages**; Mediapulse includes **Knowledge graph**; `root: true` in `meta.json` for sidebar sections).
- See the [create-project-docs](.cursor/skills/create-project-docs/SKILL.md) skill for content conventions and available MDX components.

## Related

- Root [README](../README.md) — How to run the apps and set up the project.
- [Architecture: domains](docs/architecture/domains.mdx) — Hermes vs Mediapulse boundaries; [communication](docs/architecture/communication.mdx) for cross-service flows.
