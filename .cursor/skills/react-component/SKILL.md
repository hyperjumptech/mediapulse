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
2. **Never put `useState` or `useEffect` in a component body** — components must not contain state or effect logic directly. Extract all of it into a **custom hook** (e.g. `useStepEditorPanelState`, `useSearch`) with a single responsibility. The component only calls the hook and renders.
3. **Memoize when needed** — use `useMemo`/`useCallback` inside the custom hook (or in the component only for render-related memoization) to prevent unnecessary re-renders.

## Stable component identity (factory components & slot props)

If a **factory returns a component** (a function used as `<ThatComponent />` or passed as `components={{ Field: ThatComponent }}`), the **function reference is the component’s type**. Creating a new function on every render makes React **unmount and remount** the whole subtree on each parent update. Symptoms: **inputs lose focus** while typing, cursor jumps, internal state resets.

**Do not** call component factories in the render body without stabilizing the result:

```tsx
// ❌ BAD — new component type every render (focus loss in controlled fields)
const FormSection = () => {
  const StringField = createVariableExpansionStringField({ loadVariablesPage });
  return <SchemaForm components={{ StringField }} />;
};

// ✅ GOOD — same component type across re-renders (deps = stable loaders/config)
const FormSection = ({ loadVariablesPage }: Props) => {
  const StringField = useMemo(
    () => createVariableExpansionStringField({ loadVariablesPage }),
    [loadVariablesPage],
  );
  return <SchemaForm components={{ StringField }} />;
};

// ✅ GOOD — no factory in render: fixed component + props / context
const StringField = (props: StringFieldProps) => (
  <VariableExpansionInput
    {...props}
    loadVariablesPage={loadVariablesPageFromModule}
  />
);
```

Apply the same rule when passing **any** component-as-prop to libraries (form field slots, table cell renderers, router `element`, etc.): the **type** must be stable unless you intentionally want a full remount.

```tsx
// ❌ BAD — component declared inside render = new type every time
const Parent = ({ items }: { items: Row[] }) =>
  items.map((row) => {
    const RowCell = () => <td>{row.name}</td>;
    return <RowCell key={row.id} />;
  });
```

**Prefer:** define `RowCell` outside `Parent`, or one component that receives `row` as a prop (stable type).

```tsx
// ✅ GOOD — stable RowCell; data varies via props
const RowCell = ({ name }: { name: string }) => <td>{name}</td>;
const Parent = ({ items }: { items: Row[] }) =>
  items.map((row) => <RowCell key={row.id} name={row.name} />);
```

```tsx
// ❌ BAD — useState/useEffect in the component
const SearchList = ({ items }: { items: Item[] }) => {
  const [query, setQuery] = useState("");
  useEffect(() => { ... }, [items]);
  const filtered = items.filter(...);
  return ...;
};

// ✅ GOOD — custom hook holds all state and effects
const useSearch = (items: Item[]) => {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => items.filter((i) => i.name.includes(query)),
    [items, query],
  );
  return { query, setQuery, filtered };
};

// ✅ GOOD — component only calls hook and renders
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
- [ ] **No `useState` or `useEffect` in the component** — all state/effects in a custom hook. Make sure `useEffect` does not cause infinite re-renders!
- [ ] All stateful logic in custom hooks (single responsibility per hook)
- [ ] Computed state preferred over new `useState` (inside the hook)
- [ ] Zod validation on server actions / API routes
- [ ] Server actions accepted as props (DI)
- [ ] Suspense boundaries around async components
- [ ] Text content HTML-escaped
- [ ] File name in kebab-case
- [ ] **Stable component types** — factories that return components are memoized (`useMemo` with stable deps) or defined outside the render path; slot props do not recreate component types every render
- [ ] 100% test coverage
