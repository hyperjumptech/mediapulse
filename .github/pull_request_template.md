## Summary

<!-- What does this PR change and why? -->

## Checklist (`.cursor` rules)

- [ ] I ran `pnpm code-quality` locally and it passed.
- [ ] I ran `pnpm cursor:review -- --base origin/main --head HEAD` (or equivalent SHAs) and fixed any issues.
- [ ] **Reuse before create:** I searched for existing components/utilities and reused or extended them instead of duplicating patterns.
- [ ] **Route actions / handlers:** If I added or changed `route.*.config.ts` files, I followed the route-action-gen workflow (config + generator + tests).
- [ ] **Agent Data API:** If I touched `agent-data-api` routes, the shared contract, or the SDK, I updated schemas, manifest, handlers, consumers, and `dev-docs/docs/mediapulse/apps/agent-data-api.mdx` together.
- [ ] **Docs:** I updated dev-docs when behavior or contracts changed.

## Notes for reviewers

<!-- Risks, rollout, follow-ups. -->
