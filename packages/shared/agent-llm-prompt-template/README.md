# @workspace/agent-llm-prompt-template

Shared helpers for Mediapulse/Hermes agent configs that use `{{placeholder}}` strings in LLM system and user prompts:

- `listLlmPromptPlaceholderNames` / `findUnknownLlmPromptPlaceholderTokens` — validate templates at Zod parse time.
- `substituteLlmPromptTemplate` — replace known tokens with runtime values.
- `computeLlmPromptFingerprint` — SHA-256 fingerprint (16 hex chars) of `system + "\n\n" + resolvedUser` for run diagnostics (REQ-011).

Build: `pnpm build` in this package (emits `dist/`). Consumers import from `@workspace/agent-llm-prompt-template`.
