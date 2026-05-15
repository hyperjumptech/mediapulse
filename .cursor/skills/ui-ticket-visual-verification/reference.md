# Reference: UI ticket visual verification

## Isolation ladder (quick pick)

| Ticket shape                                            | Typical approach                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Single component (checkbox, label, layout)              | Dev-only page that imports the component with fixture props.                                                           |
| Form validation / legal copy                            | Same + optional mocked submit handler that never leaves the browser.                                                   |
| Modal that depends on server truth (stock, permissions) | Fixture route or `?fixture=` that forces the server component / loader to return the edge state.                       |
| Dashboard widget needing aggregates                     | Static JSON fixture co-located with the demo route; avoid live warehouse DB.                                           |
| Auth-gated page                                         | Mock session in dev (existing test helpers or dev cookie) **or** fixture route that bypasses auth only in development. |

## Artifact layout (suggested)

```text
artifacts/ui-evidence/<slug>/
  README.md          # optional: 3–5 lines, how captured, date, ticket link
  before.png         # only if ticket needs comparison
  after.png
  flow.webm          # optional
```

Add `artifacts/` to the app or repo `.gitignore` if not already ignored.

## Monorepo dev entry points

From repo root, prefer documented scripts in root `package.json` when they exist (`pnpm dev:hermes`, `pnpm dev:user-registration`, etc.). Otherwise:

`pnpm --filter <workspace-package-name> dev`

Discover the filter name from the app’s `package.json` `"name"` field.

## Example narratives (mapping to tickets)

**Terms of service checkbox on registration**

- Add or extend a **dev-only** registration preview route (or dedicated minimal page) that renders the same client/server split as production registration.
- Mock account creation POST to return success without calling the real API.
- Repro: `pnpm dev:user-registration` (or the correct filter) + documented URL.
- Screenshot: registration form showing the new checkbox and validation error when unchecked.

**Sold-out “Add to cart” modal**

- Avoid: create user → seed item → log in → deplete stock in DB → click.
- Prefer: product or cart surface driven by **fixture stock = 0**, or dev-only PATCH that only the fixture uses; one click proves the modal.
- Screenshot: modal visible; optional second shot of in-stock control for contrast using a second query value.

## Video vs screenshot

- Screenshot: default for layout, copy, single-state modals.
- Video: loading spinners, staggered animations, multi-step wizards, drag-and-drop. Keep under ~30s when possible.
