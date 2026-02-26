# MediaPulse

## Development

### Installation

```bash
pnpm install
```

### Development database

To run the development database, run the following command:

```bash
docker-compose up
```

This will start the PostgreSQL database.

### Setup Environment Variables

```bash
cp ./packages/env/env.example ./packages/env/.env
# Adjust the values in the .env file as needed.

./dev-bootstrap.sh

```

### Setup database (Prisma)

```bash
cd packages/database
pnpm db:migrate:dev && pnpm db:generate
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
