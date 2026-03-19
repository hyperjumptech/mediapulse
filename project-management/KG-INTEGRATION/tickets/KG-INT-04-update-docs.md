# KG-INT-04: Update Documentation

## Type

Documentation

## Priority

Low

## Description

Update project documentation to reflect the knowledge graph architecture, new agents, new admin pages, and pipeline configuration.

## Acceptance criteria

- [ ] `dev-docs/docs` has a new page explaining the knowledge graph architecture
- [ ] Architecture diagram (mermaid) included showing 3 pipelines and data flow
- [ ] New agent README files created for query-analysis and analysis agents
- [ ] Existing dev-docs agent pages updated to mention the new agents
- [ ] Environment variable documentation updated for new agents
- [ ] Pipeline configuration documented (3 pipelines, schedules, expansion)
- [ ] Entity type and relation type admin pages documented
- [ ] Relevance scoring algorithm documented (5 signals, weights, formula)

## Pages to create/update

- `dev-docs/docs/architecture/knowledge-graph.mdx` (NEW)
- `dev-docs/docs/agents/query-analysis.mdx` (NEW)
- `dev-docs/docs/agents/analysis.mdx` (NEW)
- `dev-docs/docs/admin/entity-types.mdx` (NEW)
- `dev-docs/docs/admin/relation-types.mdx` (NEW)
- Update any existing agent overview pages that list all agents

## Dependencies

- All implementation tickets should be complete or near-complete before documentation
