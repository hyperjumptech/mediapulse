---
name: prisma-migrate-dev
description: Create and apply Prisma schema migrations using the project's db:migrate:dev script. Use when changing schema.prisma, adding migrations, or when the user asks to run migrations or migrate the database.
---

# Prisma Migrate Dev in This Project

Migrations are **never authored by typing SQL yourself**—always go through Prisma. This project uses `prisma migrate dev` via the **orchestration** and **Mediapulse** database package scripts (`@hermes/orchestration-database`, `@mediapulse/database`). **Checking in** the generated `prisma/migrations/.../migration.sql` after running the command is expected.

## When to use

- User asks to add a migration, run migrations, or change the database schema.
- You have edited `packages/hermes/orchestration-database/prisma/schema.prisma` or `packages/mediapulse/database/prisma/schema.prisma` and need to persist the change.

## Steps

1. **Edit the schema only**  
   Change the appropriate `schema.prisma` (models, fields, relations). Do not create migration folders or edit `migration.sql` **yourself**—let Prisma generate them when you run the command below.

2. **Run the migration command**  
   From the repository root (pick the package that owns the schema you edited):

   ```bash
   cd packages/hermes/orchestration-database && pnpm db:migrate:dev
   ```

   or

   ```bash
   cd packages/mediapulse/database && pnpm db:migrate:dev
   ```

   Or using the workspace filter:

   ```bash
   pnpm --filter @hermes/orchestration-database db:migrate:dev
   ```

   or

   ```bash
   pnpm --filter @mediapulse/database db:migrate:dev
   ```

3. **Name the migration**  
   When Prisma prompts for a migration name, use a short snake_case description (e.g. `add_variable_created_by`, `create_audit_table`).

4. **Confirm**  
   Prisma creates the migration SQL and applies it to the dev database. No manual migration file editing.

## Do not

- Hand-write new `migrations/<timestamp>_<name>/migration.sql` files or paste SQL without running `db:migrate:dev`.
- Hand-edit migration files that Prisma already generated unless the user explicitly asks to adjust an undeployed migration.

## Do

- Commit the new migration folder and `migration.sql` that Prisma produced, alongside the `schema.prisma` change.
