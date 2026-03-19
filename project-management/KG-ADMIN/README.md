# KG-ADMIN: Hermes Dashboard Admin Pages

## Summary

Add CRUD pages in the Hermes dashboard for admins to manage the knowledge graph vocabulary: entity types and relation types. These vocabularies are injected into LLM prompts by the analysis agent, so admins control what the system can classify without code changes.

## Pages

| Path                         | Purpose                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| `/dashboard/entity-types/`   | List, create, edit, delete entity types (COMPANY, PERSON, TOPIC, ...)  |
| `/dashboard/relation-types/` | List, create, edit, delete relation types (CEO_OF, SUBSIDIARY_OF, ...) |

## Patterns to follow

Follow the existing ticker CRUD pattern in `apps/hermes/app/dashboard/tickers/`:

- Server actions via `route.post.config.ts` + `route-action-gen`
- `PageHeader`, `ListPagination`, `DeleteConfirmForm` shared components
- `useFormAction` hook for form state management
- `withAuthProtection` wrapper on page components
- Tests for all server actions and components

## Dependencies

- KG-DATA (tables must exist before CRUD pages can operate)
