## Running development server

Run `pnpm dev --filter web` from the root of the monorepo

## Creating an admin user

Run `pnpm dlx tsx scripts/create-admin.ts <email> <password>` from the `apps/hermes` directory.
Example:

```bash
pnpm dlx tsx scripts/create-admin.ts kevin@hyperjump.tech password123
```

## Installing shadcn/ui component

From the `apps/web` directory, run

```bash
pnpm dlx shadcn@latest add [component]
```
