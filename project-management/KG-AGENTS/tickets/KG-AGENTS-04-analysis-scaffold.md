# KG-AGENTS-04: Scaffold Analysis Agent

## Type

Feature

## Priority

High

## Description

Scaffold the `analysis` agent package using the Turbo generator. This creates the boilerplate. The entity extraction, scoring, and selection logic are implemented in subsequent tickets.

## Acceptance criteria

- [ ] Agent package created at `apps/agents/analysis/`
- [ ] `pnpm gen:agent` (or `pnpm turbo gen agent --args analysis`) runs successfully
- [ ] Env example file created at `packages/env/env.agents.analysis.example`
- [ ] Env example includes: `PORT`, `AGENT_AUTH_API_URL`, `AGENT_DATA_API_URL`, `AGENT_REGISTRY_URL`, `AGENT_REGISTRY_API_KEY`, `AGENT_PUBLIC_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- [ ] Agent imports env from `@workspace/env/agents-analysis`
- [ ] `pnpm install` succeeds
- [ ] `pnpm build` in the agent package succeeds
- [ ] Agent starts and responds to `GET /schemas` with input schema `{ tickerId: string }`

## Steps

Same as KG-AGENTS-01 but with `analysis` as the agent name.

1. Run `pnpm gen:agent` and enter `analysis`
2. Add `OPENAI_API_KEY`, `OPENAI_MODEL`, and `AGENT_DATA_API_URL` to env example
3. Update input schema to `{ tickerId: z.string() }`
4. Run `./setup-agent-env.sh analysis`
5. Verify startup

## Dependencies

- None (scaffold can be created independently)
