# KG-ADMIN-01: Entity Type CRUD Pages in Hermes Dashboard

## Type

Feature

## Priority

Medium

## Description

Add a full CRUD section in the Hermes dashboard at `/dashboard/entity-types/` for admins to manage entity type vocabulary. Entity types define what kinds of entities the analysis agent can extract (e.g. COMPANY, PERSON, TOPIC). The `description` field is important because it's injected into the LLM prompt to guide classification.

## Acceptance criteria

- [ ] List page at `/dashboard/entity-types/` with table showing name, description, created date
- [ ] Search by name
- [ ] Sort by name or created date
- [ ] Pagination using shared `ListPagination` component
- [ ] Create modal to add new entity type (name + description)
- [ ] Edit modal to update name and description
- [ ] Delete with confirmation using shared `DeleteConfirmForm`
- [ ] Delete guard: cannot delete an entity type that has entities referencing it (show error message)
- [ ] Sidebar navigation entry added in `app-sidebar.tsx` under a "Knowledge Graph" group
- [ ] All server actions follow `route.post.config.ts` pattern with DI for testing
- [ ] All components and actions have co-located tests
- [ ] `pnpm code-quality` passes

## Implementation reference

Follow the ticker CRUD pattern exactly:

```
apps/hermes/app/dashboard/entity-types/
├── page.tsx                          # RSC list page with withAuthProtection
├── entity-types-table.tsx            # Client table component
├── entity-types-search.tsx           # Search form
├── entity-type-row-actions.tsx       # Edit + Delete dropdown
├── entity-type-edit-modal.tsx        # Edit dialog
├── entity-type-edit-form.tsx         # Edit form with FormWithAction
├── add-entity-type-modal.tsx         # Create dialog
├── actions/
│   ├── create/route.post.config.ts   # createEntityTypeHandler
│   ├── create/route.ts
│   ├── update/route.post.config.ts   # updateEntityTypeHandler
│   ├── update/route.ts
│   ├── delete/route.post.config.ts   # deleteEntityTypeHandler
│   └── delete/route.ts
```

Data layer:

```
apps/hermes/lib/entity-types.ts       # getEntityTypesPage, getEntityTypeById
```

## Form fields

**Create/Edit:**

- `name` (required, text input, uppercase convention suggested but not enforced)
- `description` (optional, textarea, explain: "This description is shown to the LLM to guide entity classification")

**Delete:**

- Hidden `body.entityTypeId` field
- Confirm dialog: "Delete entity type 'COMPANY'? This cannot be undone."
- Server-side check: `prisma.entity.count({ where: { typeId } })` — if > 0, return error "Cannot delete: N entities use this type"

## Sidebar navigation

Add to `apps/hermes/components/app-sidebar.tsx`:

```tsx
// Under a "Knowledge Graph" group or alongside existing items
<SidebarMenuItem>
  <SidebarMenuButton asChild isActive={isEntityTypes}>
    <Link href="/dashboard/entity-types">
      <Tags className="size-4" />
      <span>Entity Types</span>
    </Link>
  </SidebarMenuButton>
</SidebarMenuItem>
```

## Dependencies

- KG-DATA-01 (EntityType table must exist)
- KG-DATA-02 (migration must be applied)

## Files to create

- All files listed in the implementation reference above
- `apps/hermes/lib/entity-types.ts`
- Test files co-located with each component and action

## Files to modify

- `apps/hermes/components/app-sidebar.tsx` (add sidebar entry)
- `apps/hermes/components/dashboard-shell.tsx` (add breadcrumb segment label)
