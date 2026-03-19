# KG-AGENTS-01: Scaffold Query-Analysis Agent

## Type

Feature

## Priority

High

## Description

Scaffold the `query-analysis` agent package using the Turbo generator. This creates the boilerplate: agent app, env config, package setup. The actual LLM logic is implemented in KG-AGENTS-02.

## Acceptance criteria

- [ ] Agent package created at `apps/agents/query-analysis/`
- [ ] `pnpm gen:agent` (or `pnpm turbo gen agent --args query-analysis`) runs successfully
- [ ] Env example file created at `packages/env/env.agents.query-analysis.example`
- [ ] Env example includes: `PORT`, `AGENT_AUTH_API_URL`, `AGENT_DATA_API_URL`, `AGENT_REGISTRY_URL`, `AGENT_REGISTRY_API_KEY`, `AGENT_PUBLIC_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- [ ] `packages/env/package.json` has `build:agents.query-analysis` script
- [ ] `packages/env` exports `./agents-query-analysis`
- [ ] Root `package.json` has `dev:agent-query-analysis` script
- [ ] Agent imports env from `@workspace/env/agents-query-analysis`
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` in the agent package succeeds
- [ ] Agent starts and responds to `GET /schemas` with input schema `{ tickerId: string }`

## Steps

1. Run `pnpm gen:agent` and enter `query-analysis` as the name
2. Add `OPENAI_API_KEY` and `OPENAI_MODEL` to the env example (not included in base template)
3. Add `AGENT_DATA_API_URL` to the env example
4. Update the input schema in `src/index.ts` to `{ tickerId: z.string() }`
5. Run `./setup-agent-env.sh query-analysis`
6. Verify `pnpm dev:agent-query-analysis` starts the server

## Files created (by generator)

- `apps/agents/query-analysis/package.json`
- `apps/agents/query-analysis/tsconfig.json`
- `apps/agents/query-analysis/turbo.json`
- `apps/agents/query-analysis/vitest.config.ts`
- `apps/agents/query-analysis/src/index.ts`
- `apps/agents/query-analysis/src/index.test.ts`
- `apps/agents/query-analysis/src/run.ts`
- `apps/agents/query-analysis/src/run.test.ts`
- `packages/env/env.agents.query-analysis.example`

## Dependencies

- None (scaffold can be created independently)
