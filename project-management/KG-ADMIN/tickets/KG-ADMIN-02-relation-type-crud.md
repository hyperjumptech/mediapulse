# KG-ADMIN-02: Relation Type CRUD Pages in Hermes Dashboard

## Type

Feature

## Priority

Medium

## Description

Add a full CRUD section in the Hermes dashboard at `/dashboard/relation-types/` for admins to manage relation type vocabulary. Relation types define what kinds of relationships the analysis agent can extract between entities (e.g. CEO_OF, SUBSIDIARY_OF). The `description` field is injected into the LLM prompt.

## Acceptance criteria

- [ ] List page at `/dashboard/relation-types/` with table showing name, description, created date
- [ ] Search by name
- [ ] Sort by name or created date
- [ ] Pagination using shared `ListPagination` component
- [ ] Create modal to add new relation type (name + description)
- [ ] Edit modal to update name and description
- [ ] Delete with confirmation using shared `DeleteConfirmForm`
- [ ] Delete guard: cannot delete a relation type that has entity relations referencing it
- [ ] Sidebar navigation entry added alongside Entity Types
- [ ] All server actions follow `route.post.config.ts` pattern with DI
- [ ] All components and actions have co-located tests
- [ ] `pnpm code-quality` passes

## Implementation reference

Same structure as KG-ADMIN-01, but for relation types:

```
apps/hermes/app/dashboard/relation-types/
├── page.tsx
├── relation-types-table.tsx
├── relation-types-search.tsx
├── relation-type-row-actions.tsx
├── relation-type-edit-modal.tsx
├── relation-type-edit-form.tsx
├── add-relation-type-modal.tsx
├── actions/
│   ├── create/route.post.config.ts
│   ├── create/route.ts
│   ├── update/route.post.config.ts
│   ├── update/route.ts
│   ├── delete/route.post.config.ts
│   └── delete/route.ts
```

Data layer:

```
apps/hermes/lib/relation-types.ts     # getRelationTypesPage, getRelationTypeById
```

## Form fields

**Create/Edit:**

- `name` (required, text input, e.g. "CEO_OF")
- `description` (optional, textarea, e.g. "Person is the CEO or top executive of a company")

**Delete:**

- Server-side check: `prisma.entityRelation.count({ where: { relationTypeId } })` — if > 0, return error "Cannot delete: N entity relations use this type"

## Sidebar navigation

Add alongside Entity Types entry in `app-sidebar.tsx`:

```tsx
<SidebarMenuItem>
  <SidebarMenuButton asChild isActive={isRelationTypes}>
    <Link href="/dashboard/relation-types">
      <GitBranch className="size-4" />
      <span>Relation Types</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

## Dependencies

- KG-DATA-01 (RelationType table must exist)
- KG-DATA-02 (migration must be applied)

## Files to create

- All files listed in the implementation reference above
- `apps/hermes/lib/relation-types.ts`
- Test files co-located with each component and action

## Files to modify

- `apps/hermes/components/app-sidebar.tsx` (add sidebar entry)
- `apps/hermes/components/dashboard-shell.tsx` (add breadcrumb segment label)

## Notes

- This ticket is structurally identical to KG-ADMIN-01. If both are assigned to the same person, consider extracting shared patterns (table, search, row actions) into a reusable component or copying the entity-type implementation and renaming.
