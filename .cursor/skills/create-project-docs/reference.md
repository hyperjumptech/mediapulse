# Speed Docs Component Reference

Complete reference for all MDX components available in Speed Docs.

## Callout

Display important messages with semantic styling.

```mdx
import { Callout } from "fumadocs-ui/components/callout";

<Callout type="info">
  Informational message.
</Callout>
```

**Types:** `warn`, `info`, `success`, `error`

## Accordion

Collapsible content sections.

```mdx
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";

<Accordions>
  <Accordion title="Section Title">
    Content goes here. Supports **Markdown** and other components.
  </Accordion>
  <Accordion title="Another Section">
    More content here.
  </Accordion>
</Accordions>
```

## Steps

Numbered step-by-step instructions.

```mdx
import { Step, Steps } from "fumadocs-ui/components/steps";

<Steps>
  <Step>

### Step Title

Step content with instructions.

  </Step>
  <Step>

### Next Step

More instructions.

  </Step>
</Steps>
```

**Note:** Leave blank lines around the heading inside `<Step>` for proper MDX parsing.

## File Tree

Display directory structures.

```mdx
import { File, Folder, Files } from "fumadocs-ui/components/files";

<Files>
  <Folder name="src" defaultOpen>
    <Folder name="components">
      <File name="Button.tsx" />
      <File name="Card.tsx" />
    </Folder>
    <File name="index.ts" />
  </Folder>
  <File name="package.json" />
  <File name="tsconfig.json" />
</Files>
```

**Props:**

| Component | Prop          | Description                  |
|-----------|---------------|------------------------------|
| `Folder`  | `name`        | Folder display name          |
| `Folder`  | `defaultOpen` | Expanded by default          |
| `File`    | `name`        | File display name            |

## Tabs (Code Block Syntax)

Use the `tab` attribute on fenced code blocks. Consecutive code blocks with `tab` attributes are automatically grouped.

````mdx
```bash tab="npm"
npm install my-package
```

```bash tab="pnpm"
pnpm add my-package
```

```bash tab="yarn"
yarn add my-package
```

```bash tab="bun"
bun add my-package
```
````

## Code Blocks

### Title

````mdx
```ts title="src/config.ts"
export const config = { debug: true };
```
````

### Line Numbers

````mdx
```ts lineNumbers
const a = 1;
const b = 2;
const c = 3;
```
````

### Line Highlighting

Append `// [!code highlight]` to highlight a single line:

````mdx
```ts
const normal = true;
const highlighted = true; // [!code highlight]
const alsoNormal = true;
```
````

Highlight multiple consecutive lines with `// [!code highlight:N]`:

````mdx
```ts
const normal = true;
// [!code highlight:2]
const first = true;
const second = true;
```
````

### Word Highlighting

Highlight all occurrences of a word with `// [!code word:theWord]`:

````mdx
```ts
// [!code word:config]
const config = getConfig();
useConfig(config);
```
````

### Focus

Dim all lines except the focused one:

````mdx
```ts
const a = 1;
const focused = 2; // [!code focus]
const c = 3;
```
````

## Mermaid Diagrams

Render Mermaid diagrams inline. Pass the chart definition as a string prop:

```mdx
<Mermaid chart="graph TD; A[Start] --> B{Decision}; B -->|Yes| C[Action]; B -->|No| D[End];" />
```

Supports all Mermaid diagram types: flowcharts, sequence diagrams, class diagrams, state diagrams, ER diagrams, Gantt charts, pie charts, etc.

## meta.json Reference

### Basic Structure

```json
{
  "title": "Section Name",
  "icon": "IconName",
  "pages": ["page-one", "page-two"],
  "defaultOpen": true,
  "collapsible": true
}
```

### All Fields

| Field         | Type      | Default | Description                       |
|---------------|-----------|---------|-----------------------------------|
| `title`       | `string`  | —       | Display name in navigation        |
| `icon`        | `string`  | —       | Icon identifier                   |
| `pages`       | `array`   | —       | Ordered page list                 |
| `defaultOpen` | `boolean` | `false` | Open folder by default            |
| `collapsible` | `boolean` | `true`  | Allow collapsing folder           |
| `root`        | `boolean` | `false` | Isolate as root sidebar section   |
| `description` | `string`  | —       | Description (root folders only)   |

### Pages Array Syntax

```json
{
  "pages": [
    "page-slug",
    "---Section Label---",
    "[External Link](https://example.com)",
    "...",
    "!excluded-page"
  ]
}
```

| Entry                        | Description                                |
|------------------------------|--------------------------------------------|
| `"slug"`                     | Page or folder by filename (no extension)  |
| `"./path/to/page"`          | Relative path to page or folder            |
| `"---Label---"`             | Visual separator with label                |
| `"---[Icon]Label---"`       | Separator with icon                        |
| `"[Text](url)"`            | Navigation link                            |
| `"[Icon][Text](url)"`      | Link with icon                             |
| `"external:[Text](url)"`   | External link (opens new tab)              |
| `"..."`                      | Remaining pages sorted A–Z                 |
| `"z...a"`                    | Remaining pages sorted Z–A                 |
| `"...folder"`               | Extract items from a folder                |
| `"!item"`                    | Exclude from `...` or `z...a`              |

## Frontmatter Reference

```yaml
---
title: Page Title          # Required
description: Page summary  # Optional, used for SEO
icon: IconName             # Optional, shown in navigation
---
```

## Folder Groups

Wrap folder names in parentheses to prevent them from affecting slugs:

```
docs/
  (guides)/
    setup.mdx          # slug: /setup (not /guides/setup)
    configuration.mdx   # slug: /configuration
```
