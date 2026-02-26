---
name: create-project-docs
description: Create and manage project documentation using Speed Docs and MDX. Use when the user wants to create docs, write documentation, add doc pages, set up a docs site, scaffold documentation, or mentions Speed Docs, MDX documentation, or project docs.
---

# Create Project Documentation with Speed Docs

Build project documentation sites using [Speed Docs](https://speed-docs.dev), a CLI tool that generates static documentation websites from MDX content. Based on Fumadocs (Next.js).

## Prerequisites

- Node.js 18+
- `speed-docs` CLI installed globally (`npm install -g speed-docs`)

## Workflow

### 1. Initialize

If the project doesn't have a docs directory yet:

```bash
speed-docs init --dir ./docs
```

This creates the content directory with the template structure.

### 2. Content Structure

The content directory must follow this layout:

```
docs/                      # content root
├── config.json            # site configuration
├── logo.png               # optional logo
└── docs/                  # all documentation pages
    ├── index.mdx          # landing page
    ├── getting-started/
    │   ├── meta.json      # navigation config for this folder
    │   └── installation.mdx
    └── api/
        ├── meta.json
        └── reference.mdx
```

#### config.json

```json
{
  "nav": {
    "title": "My Documentation",
    "image": "/logo.png"
  }
}
```

The `image` field is optional. If set, prefix with `/`.

#### Static Assets

Place images and other files in the content root directory (e.g., `docs/`). Reference them with `/` prefix: `/logo.png`, `/screenshot.png`.

### 3. MDX Pages

Every `.mdx` file needs frontmatter with at least a `title`:

```mdx
---
title: Getting Started
description: Learn how to set up the project
icon: BookOpen
---

## Introduction

Your content here using standard Markdown plus MDX components.
```

**Frontmatter fields:**

| Field         | Required | Description              |
| ------------- | -------- | ------------------------ |
| `title`       | Yes      | Page title               |
| `description` | No       | Page description for SEO |
| `icon`        | No       | Icon name for navigation |

**Slug generation:** Slugs derive from file paths relative to `docs/`:

- `docs/guide/setup.mdx` &rarr; `/guide/setup`
- `docs/guide/index.mdx` &rarr; `/guide`

### 4. Navigation with meta.json

Each folder can have a `meta.json` to control navigation order and display:

```json
{
  "title": "Guide",
  "icon": "BookOpen",
  "pages": ["index", "installation", "configuration"],
  "defaultOpen": true
}
```

| Field         | Description                              |
| ------------- | ---------------------------------------- |
| `title`       | Display name in sidebar                  |
| `icon`        | Icon name                                |
| `pages`       | Ordered list of page file names (no ext) |
| `defaultOpen` | Folder open by default (default: false)  |

**Special `pages` syntax:**

| Syntax          | Description                   |
| --------------- | ----------------------------- |
| `"page-name"`   | Include a specific page       |
| `"---Label---"` | Separator with label          |
| `"[Text](url)"` | External link                 |
| `"..."`         | Include remaining pages (A-Z) |
| `"z...a"`       | Include remaining pages (Z-A) |
| `"!item"`       | Exclude item from `...`       |

Example:

```json
{
  "title": "API Reference",
  "pages": ["overview", "---Endpoints---", "users", "products", "..."]
}
```

**Root folders:** Add `"root": true` to create isolated sidebar sections:

```json
{
  "title": "Framework",
  "root": true,
  "pages": ["index", "setup", "configuration"]
}
```

### 5. Available MDX Components

Import from `fumadocs-ui/components/*`. For details, see [reference.md](reference.md).

**Callout** (warn/info/success/error):

```mdx
import { Callout } from "fumadocs-ui/components/callout";

<Callout type="warn">This is a warning message.</Callout>
```

**Accordion:**

```mdx
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";

<Accordions>
  <Accordion title="Question 1">Answer 1</Accordion>
  <Accordion title="Question 2">Answer 2</Accordion>
</Accordions>
```

**Steps:**

```mdx
import { Step, Steps } from "fumadocs-ui/components/steps";

<Steps>
  <Step>### Install dependencies Run `npm install`.</Step>
  <Step>### Configure Edit `config.json`.</Step>
</Steps>
```

**File Tree:**

```mdx
import { File, Folder, Files } from "fumadocs-ui/components/files";

<Files>
  <Folder name="src" defaultOpen>
    <File name="index.ts" />
    <File name="utils.ts" />
  </Folder>
  <File name="package.json" />
</Files>
```

**Tabs** (via code block syntax):

````mdx
```ts tab="JavaScript"
console.log("Hello");
```

```py tab="Python"
print("Hello")
```
````

**Code features:**

- Title: ` ```ts title="config.ts" `
- Line numbers: ` ```ts lineNumbers `
- Highlight: append `// [!code highlight]` to a line
- Multi-line highlight: `// [!code highlight:3]` (highlights next 3 lines)
- Word highlight: `// [!code word:myVariable]`
- Focus: `// [!code focus]`

**Mermaid diagrams:**

```mdx
<Mermaid chart="graph TD; A-->B; B-->C;" />
```

Always use the `<Mermaid>` component to render mermaid diagrams. Using code fence block will not render the diagram!

Use the "mermaid-diagram" skill to create the chart definition string.

### 6. Build and Preview

```bash
# Development mode (hot reload)
speed-docs --dev ./docs

# Production build
speed-docs ./docs

# Preview built output
npx serve@latest docs-output
```

### 7. Deploy

**Any static host:** Deploy the `docs-output/` directory.

**GitHub Pages:** Use the [Speed Docs GitHub Action](https://github.com/nicnocquee/speed-docs-github-action):

```yaml
name: Deploy Documentation
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Pages
        id: setup_pages
        uses: actions/configure-pages@v5
      - name: Deploy docs
        uses: nicnocquee/speed-docs-github-action@v1
        with:
          content-path: "./docs"
          github-token: ${{ secrets.GITHUB_TOKEN }}
          base-path: ${{ steps.setup_pages.outputs.base_path }}
```

**Custom base path:** If deploying to a subpath (e.g., `example.com/docs`):

```bash
speed-docs --base-path /docs ./docs
```

## Scaffolding New Pages

Use the scaffold script to create new doc pages quickly:

```bash
bash ~/.cursor/skills/create-project-docs/scripts/scaffold-page.sh <content-dir> <path> "<title>" ["<description>"]
```

Example:

```bash
bash ~/.cursor/skills/create-project-docs/scripts/scaffold-page.sh ./docs guide/quickstart "Quick Start" "Get up and running in 5 minutes"
```

This creates the MDX file with frontmatter and updates the parent `meta.json`.

## Additional Resources

- For complete component reference and examples, see [reference.md](reference.md)
- [Speed Docs documentation](https://speed-docs.dev)
- [Fumadocs page conventions](https://fumadocs.dev/docs/headless/page-conventions)
