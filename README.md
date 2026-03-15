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

The example files already contain the correct values for some environment variables for development purposes. But you still need to add the correct values for the following environment variables in the generated `.env` file:

| Environment Variable | Description                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| JINA_API_KEY         | The API key for the Jina AI API. Get it from the landing page of [Jina.ai](https://jina.ai)   |
| SERPER_API_KEY       | The API key for the Serper API. Create a new free account in [Serper.dev](https://serper.dev) |
| OPENAI_API_KEY       | The API key for the OpenAI API. Create a new free account in [OpenAI](https://openai.com)     |

### Development database

To run the development database, run the following command:

```bash
docker compose up
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
| user-registration        | 3002 |
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

### Running `user-registration`

```bash
pnpm dev --filter=user-registration
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
docker compose -f docker compose-all.yml up
```

### Observability

You can now start the observability stack by running:

```bash
docker compose -f docker compose-all.yml up -d jaeger otel-collector prometheus
```

Then start your apps as usual. Traces will be available at <http://localhost:16686> (Jaeger) and metrics at <http://localhost:9090> (Prometheus).

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
