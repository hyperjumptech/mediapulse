# Mermaid Syntax Reference

Extended reference for edge cases and advanced features.

## Flowchart Advanced

### Link text (edge labels)

```mermaid
flowchart LR
  A -->|"label text"| B
  C -- "label text" --> D
```

Both syntaxes are valid. Prefer the `|"text"|` form for consistency.

### Multi-line labels

Use `<br/>` for line breaks inside quoted labels:

```mermaid
flowchart TD
  A["Line one<br/>Line two"]
```

### Subgraph nesting

Subgraphs can be nested. Each must have a unique ID:

```mermaid
flowchart TD
  subgraph outer ["Outer"]
    subgraph inner ["Inner"]
      A --> B
    end
  end
```

### Styling nodes

```mermaid
flowchart TD
  A["Styled"]:::highlight --> B
  classDef highlight fill:#f96,stroke:#333,color:#fff
```

### Styling links (edges)

```mermaid
flowchart TD
  A --> B
  linkStyle 0 stroke:red,stroke-width:2px
```

`linkStyle` uses zero-based index of the link in declaration order.

---

## Sequence Diagram Advanced

### Activation shorthand

Use `+` and `-` suffixes on arrows instead of explicit `activate`/`deactivate`:

```mermaid
sequenceDiagram
  A->>+B: request
  B-->>-A: response
```

### Loops and conditionals

```mermaid
sequenceDiagram
  participant A
  participant B

  loop Every 5s
    A->>B: ping
    B-->>A: pong
  end

  alt success
    A->>B: data
  else failure
    A->>B: retry
  end

  opt optional step
    A->>B: extra
  end
```

### Parallel execution

```mermaid
sequenceDiagram
  par Task A
    A->>B: request 1
  and Task B
    A->>C: request 2
  end
```

### Autonumbering

Add `autonumber` after the diagram type to auto-label messages:

```mermaid
sequenceDiagram
  autonumber
  A->>B: first
  B->>C: second
```

---

## Class Diagram Advanced

### Visibility markers

| Marker | Meaning |
|--------|---------|
| `+` | Public |
| `-` | Private |
| `#` | Protected |
| `~` | Package/Internal |

### Generic types

```mermaid
classDiagram
  class List~T~ {
    +add(item T) void
    +get(index int) T
  }
```

### Annotations

```mermaid
classDiagram
  class Shape {
    <<interface>>
    +area() double
  }

  class Color {
    <<enumeration>>
    RED
    GREEN
    BLUE
  }
```

### Namespace grouping

```mermaid
classDiagram
  namespace com.example {
    class Foo
    class Bar
  }
```

---

## State Diagram Advanced

### Composite (nested) states

```mermaid
stateDiagram-v2
  [*] --> Active

  state Active {
    [*] --> Running
    Running --> Paused : pause
    Paused --> Running : resume
  }

  Active --> [*] : stop
```

### Choice pseudo-state

```mermaid
stateDiagram-v2
  state check <<choice>>
  [*] --> check
  check --> Valid : if valid
  check --> Invalid : if invalid
```

### Fork and join

```mermaid
stateDiagram-v2
  state fork_state <<fork>>
  state join_state <<join>>

  [*] --> fork_state
  fork_state --> TaskA
  fork_state --> TaskB
  TaskA --> join_state
  TaskB --> join_state
  join_state --> [*]
```

### Notes

```mermaid
stateDiagram-v2
  State1 : Description here
  note right of State1
    Additional context
  end note
```

---

## ER Diagram Advanced

### Entity attributes

```mermaid
erDiagram
  USER {
    int id PK
    string email UK
    string name
    datetime created_at
  }

  ORDER {
    int id PK
    int user_id FK
    decimal total
  }

  USER ||--o{ ORDER : places
```

Attribute markers: `PK` (primary key), `FK` (foreign key), `UK` (unique key).

---

## Gantt Chart Advanced

### Task status

```mermaid
gantt
  dateFormat YYYY-MM-DD
  section Tasks
    Completed task :done, t1, 2025-01-01, 10d
    Active task    :active, t2, after t1, 5d
    Future task    :t3, after t2, 7d
    Critical task  :crit, t4, after t3, 3d
```

Status keywords: `done`, `active`, `crit`. Can be combined: `crit, active`.

### Milestones

```mermaid
gantt
  dateFormat YYYY-MM-DD
  section Milestones
    Release :milestone, m1, 2025-03-01, 0d
```

---

## Git Graph Advanced

### Cherry-pick

```mermaid
gitGraph
  commit id: "init"
  branch feature
  commit id: "feat-1"
  commit id: "feat-2"
  checkout main
  cherry-pick id: "feat-1"
  commit id: "release"
```

### Tags

```mermaid
gitGraph
  commit id: "init" tag: "v1.0"
  commit id: "fix"
  commit id: "release" tag: "v1.1"
```

### Branch ordering

```mermaid
%%{init: { 'gitGraph': { 'mainBranchOrder': 1 } } }%%
gitGraph
  commit
  branch develop order: 2
  commit
  branch feature order: 3
  commit
```

---

## Theme Configuration

Apply themes via frontmatter directive:

```mermaid
%%{init: {'theme': 'dark'}}%%
flowchart TD
  A --> B
```

Available themes: `default`, `dark`, `forest`, `neutral`, `base`.

### Custom theme variables

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#ff6600', 'primaryTextColor': '#fff'}}}%%
flowchart TD
  A --> B
```
