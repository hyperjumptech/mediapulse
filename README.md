# MediaPulse

## Development

### Installation

```bash
pnpm install
```

### Setup Environment Variables

Run one of the following commands to setup the environment variables:

```bash
./dev-bootstrap.sh
./dev-bootstrap.sh -f # to remove existing .env and .env.local files first
```

The script will read the env.\*.example files and merge them into a single .env file. Then it will create symlinks for the environment variables in the apps and packages directories. This way the apps and packages can use the environment variables from the same .env file.

### Development database

To run the development database, run the following command:

```bash
docker-compose up
```

This will start the PostgreSQL database.

### Setup database (Prisma)

```bash
cd packages/database
pnpm db:migrate:dev && pnpm db:generate
cd ../..
```

### Running all apps (`pnpm dev`)

When you run `pnpm dev`, Turbo starts every app’s dev server. Each app is bound to a different port so they can run together:

| App                      | Port |
| ------------------------ | ---- |
| dashboard                | 3000 |
| hermes                   | 3001 |
| agent-auth-api           | 8080 |
| agent-data-api           | 8081 |
| agent-registry-api       | 8082 |
| data-collection agent    | 4001 |
| content-generation agent | 4002 |
| delivery agent           | 4003 |

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

### Running `hermes-worker`

```bash
pnpm dev --filter=hermes-worker
```

### Running non-development everything in Docker

```bash
docker-compose -f docker-compose-all.yml up
```

### Documentation

The documentation is built using [Speed Docs](https://speed-docs.dev). To run the documentation server, run the following command:

```bash
pnpm docs:dev
```

To build the documentation, run the following command:

```bash
pnpm docs:build
```

Keep the docs updated everytime you make changes to the project.
