---
name: prisma-migrate-dev
description: Create and apply Prisma schema migrations using the project's db:migrate:dev script. Use when changing schema.prisma, adding migrations, or when the user asks to run migrations or migrate the database.
---

# Prisma Migrate Dev in This Project

Migrations are **never** created by hand. This project uses `prisma migrate dev` via the database package script.

## When to use

- User asks to add a migration, run migrations, or change the database schema.
- You have edited `packages/database/prisma/schema.prisma` and need to persist the change.

## Steps

1. **Edit the schema only**  
   Change `packages/database/prisma/schema.prisma` (models, fields, relations). Do not create or edit files under `prisma/migrations/`.

2. **Run the migration command**  
   From the repository root:

   ```bash
   cd packages/database && pnpm db:migrate:dev
   ```

   Or using the workspace filter:

   ```bash
   pnpm --filter @workspace/database db:migrate:dev
   ```

3. **Name the migration**  
   When Prisma prompts for a migration name, use a short snake_case description (e.g. `add_variable_created_by`, `create_audit_table`).

4. **Confirm**  
   Prisma creates the migration SQL and applies it to the dev database. No manual migration file editing.

## Do not

- Create `migrations/<timestamp>_<name>/migration.sql` yourself.
- Paste or write raw SQL into migration files unless the user explicitly asks to modify an existing, undeployed migration.
