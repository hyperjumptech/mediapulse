---
name: ui-design
description: Apply Refactoring UI design principles with Tailwind CSS and Shadcn implementation. Use when the user asks for design advice, UI review, layout help, visual hierarchy improvements, color choices, spacing decisions, typography, shadows, or when building or polishing any user-facing component.
---

# UI Design (Refactoring UI + Tailwind/Shadcn)

## Starting From Scratch

- Design a **feature**, not a layout. Build real functionality before navigation shells.
- Work **low-fidelity first** — grayscale, no detailed styling.
- Design in short cycles: simple version → build → iterate.
- Be pessimistic: design the **smallest useful version** first.

## Visual Hierarchy

Not all elements are equal — establish primary, secondary, and tertiary levels.

| Level     | Text color         | Font weight | Tailwind                        |
| --------- | ------------------ | ----------- | ------------------------------- |
| Primary   | `foreground`       | 600–700     | `text-foreground font-semibold` |
| Secondary | `muted-foreground` | 400–500     | `text-muted-foreground`         |
| Tertiary  | lighter grey       | 400         | `text-muted-foreground/70`      |

- Emphasize by **de-emphasizing** competing elements.
- Labels are a last resort — make data self-explanatory.
- On colored backgrounds, hand-pick colors instead of using grey or opacity.

## Spacing

Use Tailwind's default spacing scale (multiples of 4px). Prefer these stops:

`1 (4px) · 2 (8px) · 3 (12px) · 4 (16px) · 6 (24px) · 8 (32px) · 12 (48px) · 16 (64px) · 24 (96px) · 32 (128px)`

- Start with **too much** white space, then remove until balanced.
- More space **between** groups than **within** them.
- Not everything should be fluid — use `max-w-*` when appropriate.
- Elements should scale **independently** — avoid relative sizing across breakpoints.

## Typography

Type scale mapped to Tailwind:

| Use             | Size    | Tailwind                | Line-height            |
| --------------- | ------- | ----------------------- | ---------------------- |
| Small / caption | 12px    | `text-xs`               | 1.5 (`leading-normal`) |
| Body small      | 14px    | `text-sm`               | 1.5                    |
| Body            | 16px    | `text-base`             | 1.5                    |
| Subheading      | 18–20px | `text-lg` / `text-xl`   | 1.4                    |
| Heading         | 24–30px | `text-2xl` / `text-3xl` | 1.25                   |
| Display         | 36–48px | `text-4xl` / `text-5xl` | 1.1                    |
| Hero            | 60–72px | `text-6xl` / `text-7xl` | 1.0                    |

- Keep line length **45–75 characters** → `max-w-prose` or `max-w-2xl`.
- Line-height is **inversely proportional** to font size.
- Use only **two font weights**: normal (400–500) and bold (600–700).
- Increase `tracking-wide` or `tracking-wider` for **all-caps** text.
- Align mixed font sizes by **baseline**, not center.

## Color

This project uses **OKLCH** color tokens defined in `packages/ui/src/styles/globals.css`.

### Semantic tokens (use these, not raw colors)

| Token                                | Tailwind class                           | Use for                         |
| ------------------------------------ | ---------------------------------------- | ------------------------------- |
| `background` / `foreground`          | `bg-background text-foreground`          | Page body                       |
| `card` / `card-foreground`           | `bg-card text-card-foreground`           | Cards, panels                   |
| `primary` / `primary-foreground`     | `bg-primary text-primary-foreground`     | CTA buttons, key actions        |
| `secondary` / `secondary-foreground` | `bg-secondary text-secondary-foreground` | Secondary buttons               |
| `muted` / `muted-foreground`         | `bg-muted text-muted-foreground`         | Subtle backgrounds, helper text |
| `accent` / `accent-foreground`       | `bg-accent text-accent-foreground`       | Hover states, highlights        |
| `destructive`                        | `bg-destructive text-destructive`        | Errors, delete actions          |

### Principles

- Need **8–10 shades per color** when extending the palette. Define them upfront (100–900).
- Don't rely on color alone — add icons, contrast, or text indicators.
- Flip contrast for accessibility: dark text on light bg, light text on dark bg.
- The project supports **dark mode** via the `.dark` class — always test both themes.

## Shadows & Depth

Use a 5-level elevation scale. Combine two shadows for realism.

| Level | Tailwind    | Use for                                 |
| ----- | ----------- | --------------------------------------- |
| 1     | `shadow-sm` | Subtle lift (inputs, cards at rest)     |
| 2     | `shadow`    | Default elevation (cards, dropdowns)    |
| 3     | `shadow-md` | Popovers, floating elements             |
| 4     | `shadow-lg` | Modals, dialogs                         |
| 5     | `shadow-xl` | Toast notifications, prominent overlays |

- Light comes from above → lighter top edges, darker bottom edges.
- For flat aesthetic, use solid shadows: `shadow-[0_2px_0_0_rgba(0,0,0,0.1)]`.
- Use color instead of shadows for depth: lighter = closer, darker = further.

## Borders & Dividers

- **Fewer borders**: prefer `shadow-sm`, `bg-muted`, or extra spacing instead.
- When borders are needed, use `border-border` (the project's semantic token).
- Accent borders (3–5px) add visual interest: `border-l-4 border-primary`.

## Images & Icons

- Use fixed containers for user-uploaded images → `aspect-square object-cover rounded-*`.
- Don't scale icons beyond their intended size — use appropriately sized icons.
- Add `ring-1 ring-inset ring-black/5` to prevent background bleed on images.
- For text over images, add overlays: `bg-gradient-to-t from-black/60`.

## Empty States

- Design empty states with imagery and a clear CTA.
- Never show a blank page — provide helpful guidance.

```tsx
<div className="flex flex-col items-center gap-4 py-16 text-center">
  <Icon className="size-12 text-muted-foreground/50" />
  <div className="space-y-1">
    <p className="text-lg font-medium">No projects yet</p>
    <p className="text-sm text-muted-foreground">
      Create your first project to get started.
    </p>
  </div>
  <Button>Create project</Button>
</div>
```

## Design Systems & Consistency

- Define and reuse systems for: font sizes, weights, colors, spacing, shadows, border radius.
- Limit choices — design by **elimination** from a constrained scale.
- The project's border-radius scale: `rounded-sm` / `rounded-md` / `rounded-lg` / `rounded-xl` (mapped from `--radius`).

## When Providing Design Advice

1. Consider **hierarchy and importance** first.
2. Suggest specific values from the scales above.
3. Explain the **why** behind recommendations.
4. Offer **2–3 concrete options** with Tailwind classes, not abstract advice.
5. Always prioritize **clarity, hierarchy, and consistency** over decoration.
