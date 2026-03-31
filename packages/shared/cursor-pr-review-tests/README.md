# @workspace/cursor-pr-review-tests

This package exists so `turbo test` / `turbo test:coverage` can execute unit tests for the repo-root automation under `scripts/lib/`.

- Implementation: `scripts/lib/cursor-pr-review.mjs`
- Tests: `scripts/lib/cursor-pr-review.test.ts`

Run from repo root:

```bash
pnpm --filter @workspace/cursor-pr-review-tests test:coverage
```
