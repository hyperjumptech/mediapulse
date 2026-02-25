## Running development server

Run `pnpm dev --filter web` from the root of the monorepo

## Creating a user in the database

Run `pnpm dlx tsx scripts/create-user.ts <email> <password>` from the `apps/dashboard` directory.
Example:

```bash
pnpm dlx tsx scripts/create-user.ts kevin@hyperjump.tech password123
```

## Installing shadcn/ui component

From the `apps/web` directory, run

```bash
pnpm dlx shadcn@latest add [component]
```
