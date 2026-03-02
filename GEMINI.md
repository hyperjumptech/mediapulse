# Gemini Project Guidelines

This document consolidates the rules and skills for the current project. You must follow these guidelines for all code generation and modification tasks.

## 1. Primary Directive: Read Before Coding

**Critical**: Before writing or editing any code, you must:

1. **Identify applicable rules** based on file type (e.g., TS/JS standards for `.ts`/`.tsx`).
2. **Consult relevant skills** referenced by those rules (e.g., `react-component` for UI).
3. **Apply standards immediately**—do not write non-compliant code and fix it later.

---

## 2. Core Standards

### TypeScript & JavaScript (`typescript-javascript-standards.mdc`)

* **File Naming**: Kebab-case (e.g., `user-service.ts`, `get-active-users.test.ts`).
* **Functions**:
  * Small, modular, one responsibility.
  * **Dependency Injection**: Accept collaborators as parameters (with production defaults).
  * **JSDoc**: Required for every function (desc, params, return).
  * **100% Test Coverage**: Required for every function.
* **Dependency Injection**:
  * Props/params must have default values representing the production implementation.
  * Example: `function UserList({ fetchUsers = apiFetchUsers }: { fetchUsers?: () => Promise<User[]> })`
* **Testing**:
  * Co-locate tests (`.test.ts` next to source).
  * Use `vitest` with 100% coverage requirement.
  * Avoid mocks where possible; use fakes/DI.
  * Test error paths, not just happy paths.
* **Formatting**: Prettier (all supported languages).
* **Linting**: Zero errors/warnings allowed before finishing.

### Planning (`planning-ts-js-standards.mdc`)

When planning tasks, every step must account for standards:

* Include **JSDoc** creation.
* Include **Dependency Injection** setup.
* Include **Unit Tests** (100% coverage).
* Include **Linter/TS error resolution**.

### Environment Variables (`env-variables.mdc` & `skills/env-variables`)

* **Access**: NEVER use `process.env` directly. Import `env` from `@workspace/env` (or per-app `env.app1`).
* **Security**: `NEXT_PUBLIC_` prefix is for client-side ONLY. Credentials must be server-only.
* **Documentation**:
  * Add new vars to `packages/env/env.example` (or `env.example.<app>`).
  * Use annotations: `#required`, `#number`, `#default`.
  * Run `pnpm build` in `packages/env` to regenerate types.
* **Local Dev**: Use `./dev-bootstrap.sh` to symlink `.env`.

### Backend: Route & Action Generation (`route-action-gen-workflow.mdc`)

For Next.js App Router (Handlers), Pages Router (API Routes), or Server Actions:

1. **Scaffold Config**: `npx route-action-gen create <method> <directory>`
    * Or create `route.<method>.config.ts` exporting `requestValidator`, `responseValidator`, and `handler`.
2. **Generate**: Run `npx route-action-gen`.
    * Generates handlers, Zod schemas, types, and client hooks.
3. **Test**: Create `route.<method>.config.test.ts`.
    * Test `handler` directly.
    * Mock external dependencies at the boundary.

---

## 3. Specialized Skills

### React Components (`skills/react-component`)

* **Stack**: TypeScript, Shadcn UI, Tailwind CSS.
* **Conventions**:
  * `const` arrow functions (no `function` keyword or `React.FC`).
  * No `any` type.
  * HTML-escape text content.
* **Architecture**:
  * Server Components by default.
  * Client Components only for interactivity/hooks.
  * Suspense + Streaming for async data.
* **Data & State**:
  * Mutations: Server Actions + `useActionState` (via `route-action-gen`)
  * Client fetching: Use generated hooks/clients from `route-action-gen`
  * Validate inputs with Zod
  * State hierarchy: Computed state > Custom hooks > `useState`
  * Extract `useState`/`useEffect` into custom hooks 
  * Memoize appropriately (`useMemo`/`useCallback`) to prevent re-renders

### UI Design (`skills/ui-design`)

* **Principles**: Refactoring UI + Tailwind.
* **Hierarchy**: Primary (`text-foreground font-semibold`), Secondary (`text-muted-foreground`), Tertiary (`text-muted-foreground/70`).
* **Spacing**: Tailwind scale (4px multiples). Start with too much whitespace.
* **Components**: Use `shadcn` primitives.
* **Colors**: Semantic tokens only (`bg-background`, `text-primary`, `bg-muted`). Do not use raw colors.
* **Shadows**: 5-level scale (`shadow-sm` to `shadow-xl`). Combine two shadows for realism.
* **Border Radius**: Conform to the project scale (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`).

### Email Templates (`skills/email-template`)

* **Location**: `packages/email-templates/src/<domain>/`.
* **Naming**: Kebab-case (e.g., `src/user/welcome-email.tsx`).
* **Structure**:
  * Export `interface {N = ({...}: {Name}Props): React.JSX.Element => { ... }
  * Export `const {Name}: React.FC<Props>`.
  * Export `{Name}.PreviewProps` (using `satisfies`).
  * Default export the component.
* **Styling**: `React.CSSProperties` consts at bottom of file.
* **Regen**: Run `pnpm --filter @workspace/email-templates generate`.

### Unit Testing (`skills/vitest-unit-testing`)

* **Structure**: `// Setup`, `// Act`, `// Assert` comments (omit Setup if no meaningful setup).
* **Mock Hygiene**:
  * ALWAYS add `afterEach(() => vi.restoreAllMocks())` in every `describe` block using mocks
  * Use `vi.resetModules()` for module-level state leakage
  * ALWAYS restore fake timers (`vi.useRealTimers()`) and clean up database/filesystem side-effects in `afterEach`
* **Preventing False Positives**:
  * Assert specific values, not just truthiness
  * Test both positive AND negative cases
  * Use `expect.assertions(n)` for conditional/async paths
  * Never rely solely on `not.toThrow`
* **Test Isolation**: Each test must produce identical results when run solo vs. in full suite
* **Mocking**: Mock at system boundaries. Prefer DI over `vi.mock()`. Use `vi.mocked()` for type safety.

### Documentation (`skills/create-project-docs`)

* **Tool**: Speed Docs (MDX + Fumadocs).
* **Structure**: `docs/config.json`, `docs/docs/index.mdx`, `meta.json` for folders.
* **Frontmatter**: `title` (required), `description`, `icon`.
* **Components**:
  * `Callout` (types: `info`, `warn`, `success`, `error`)
  * `Steps` with numbered instructions
  * `File/Folder/Files` for directory trees
  * `Mermaid` component (not code blocks) with `chart="..."` prop
  * Code blocks with `tab="..."` for automatic grouping
  * Line highlighting: `// [!code highlight]`, word highlighting: `// [!code word:term]`
* **meta.json**: Advanced features like `"..."` (remaining pages), `"---Label---"` (separators), `"!excluded"` (exclusions)
* **Scaffolding**: Use `bash .cursor/skills/create-project-docs/scripts/scaffold-page.sh <content-dir> <path> "<title>" ["<description>"]`

### Mermaid Diagrams (`skills/mermaid-diagram`)

* **Critical Syntax Rules**:
  * Quote all labels with special chars: `A["User (admin)"]`
  * IDs must be alphanumeric + underscore only
  * First line: Diagram type (no blank lines above)
  * Avoid reserved words as bare IDs (`end`, `graph`, etc.)
  * Use correct arrows per type: `-->` (flowchart), `->>` (sequence)
* **Advanced Features**:
  * Multi-line labels: `A["Line 1<br/>Line 2"]`
  * Edge labels: `A -->|"label"| B`
  * Styling: `A:::className` + `classDef className fill:#f96`
  * Themes: `%%{init: {'theme': 'dark'}}%%`
* **Validation Workflow**:
    1. Write diagram to temp `.mmd` file
    2. Run `bash .cursor/skills/mermaid-diagram/scripts/validate.sh <file.mmd>`
    3. Script auto-installs `@mermaid-js/mermaid-cli` if missing
    4. Fix errors until validation passes (exit code 0)
    5. Only present diagram after successful validation

---

## 4. Quick Reference

### Command Patterns

| Task | Command |
|------|---------|

| Create route config | `npx route-action-gen create <method> <directory>` |
| Generate route files | `npx route-action-gen` |
| Rebuild env types | `pnpm build --filter @workspace/env` |
| Regenerate email templates | `pnpm --filter @workspace/email-templates generate` |
| Start dev docs server | `speed-docs --dev ./docs` |
| Scaffold doc page | `bash .cursor/skills/create-project-docs/scripts/scaffold-page.sh <content-dir> <path> "<title>" ["<description>"]` |
| Validate mermaid | `bash .cursor/skills/mermaid-diagram/scripts/validate.sh <file.mmd>` |
| Symlink env files | `./dev-bootstrap.sh` |

### File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|

| Components | kebab-case.tsx | `user-profile.tsx` |
| Tests | kebab-case.test.ts | `user-profile.test.ts` |
| Route configs | route.{method}.config.ts | `route.post.config.ts` |
| Email templates | kebab-case.tsx | `password-reset.tsx` |
| Documentation | kebab-case.mdx | `getting-started.mdx` |

### Essential Imports

```typescript
// Environment variables
import { env } from "@workspace/env";

// React Email components  
import { Body, Container, Head, Html, Preview, Text } from "@react-email/components";

// Zod validation
import { z } from "zod";

// Route action generation
import { createRequestValidator, successResponse, errorResponse } from "route-action-gen/lib";

// Vitest testing
import { describe, it, expect, vi, afterEach } from "vitest";
```
