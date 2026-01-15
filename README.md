# MediaPulse

## Development

### Installation

```bash
pnpm install
```

### Setup Environment Variables

```bash
cp ./packages/env/.env.example ./packages/env/.env

# Adjust the values in the .env file as needed.
```

### Setup Prisma

```bash
cd packages/prisma
pnpm migrate:dev && pnpm generate
cd ../..
```

---

### Running `agent-auth-api`

```bash
pnpm dev --filter=agent-auth-api
```

### Running `agent-data-api`

```bash
pnpm dev --filter=agent-data-api
```

### Running `agent-registry-api`

```bash
pnpm dev --filter=agent-registry-api
```

### Running `dashboard`

```bash
pnpm dev --filter=dashboard
```

### Running `hermes`

```bash
pnpm dev --filter=hermes
```
