---
name: react-component
description: Generate React components following TypeScript, Shadcn/Tailwind, composable patterns, and server-first conventions. Use when the user asks to create, build, scaffold, or generate a React component, page, form, dialog, or any UI element.
---

# React Component Generation

## Component Conventions

- **TypeScript** only — never use the `any` type.
- **Arrow functions** — use `const` declarations, never `function` or `React.FC`.
- **Shadcn + Tailwind** for all UI primitives and styling.
- **HTML-escape** all rendered text content.
- **File names** in kebab-case.

```tsx
// ✅ Good
const UserCard = ({ name }: { name: string }) => {
  return <Card>{name}</Card>;
};

// ❌ Bad — React.FC, function keyword
const UserCard: React.FC<Props> = function UserCard({ name }) { ... };
```

## Architecture Priorities

Apply these in order of preference:

1. **Server Component** — default choice. No `"use client"` unless required.
2. **Client Component** — only when interactivity, hooks, or browser APIs are needed.
3. **Suspense + Streaming** — wrap async server components in `<Suspense>` with fallback.

## Data & Mutations

| Scenario               | Approach                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data mutation          | Server Action + `useActionState` using `route-action-gen`. See the `/route-action-gen-workflow` rule for more details.                                                         |
| Server action coupling | Accept server action via **props** (dependency injection)                                                                                                                      |
| Client-side fetching   | Use the generated files by `route-action-gen` to fetch data from the server action or API end point/route handler. See the `/route-action-gen-workflow` rule for more details. |
| Input validation       | **Zod** in every server action and API endpoint                                                                                                                                |

```tsx
// Server action injected via props
const CreatePostForm = ({
  createPost,
}: {
  createPost: (fd: FormData) => Promise<State>;
}) => {
  const [state, formAction, pending] = useActionState(createPost, initialState);
  return <form action={formAction}>...</form>;
};
```

## State Management Rules

1. **Computed state first** — derive values from existing state/props instead of adding new state.
2. **No hooks in components** — extract all `useState`/`useEffect` into custom hooks with a single responsibility.
3. **Memoize when needed** — use `useMemo`/`useCallback` to prevent unnecessary re-renders.

```tsx
// ✅ Custom hook encapsulates all stateful logic
const useSearch = (items: Item[]) => {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => items.filter((i) => i.name.includes(query)),
    [items, query],
  );
  return { query, setQuery, filtered };
};

// ✅ Component stays clean
const SearchList = ({ items }: { items: Item[] }) => {
  const { query, setQuery, filtered } = useSearch(items);
  return ...;
};
```

## Composability Patterns

- **Composable components** — use children, render props, or slots for flexible composition.
- **Higher-Order Components** — use HOCs only for cross-cutting concerns not coupled to the component.
- **Co-locate related code** — group related components, hooks, and helpers in the same file when it aids distribution and reuse.

```tsx
// Composable pattern
const DataTable = ({ children }: { children: React.ReactNode }) => (
  <Table>{children}</Table>
);

const DataTableHeader = ({ columns }: { columns: string[] }) => (
  <TableHeader>
    <TableRow>
      {columns.map((col) => (
        <TableHead key={col}>{col}</TableHead>
      ))}
    </TableRow>
  </TableHeader>
);
```

## Testing

- **100% coverage** for every function and hook.
- Prefer **dependency injection** over mocking.
- Keep functions small, modular, and composable so they are easily testable.

## Quick Checklist

Before finalizing a component, verify:

- [ ] TypeScript with no `any`
- [ ] `const` arrow function, no `React.FC`
- [ ] Shadcn primitives + Tailwind classes
- [ ] Server component unless interactivity is required
- [ ] All stateful logic in custom hooks
- [ ] Computed state preferred over new `useState`
- [ ] Zod validation on server actions / API routes
- [ ] Server actions accepted as props (DI)
- [ ] Suspense boundaries around async components
- [ ] Text content HTML-escaped
- [ ] File name in kebab-case
- [ ] 100% test coverage
