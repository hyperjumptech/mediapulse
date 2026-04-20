/**
 * Single source of truth for the content-generation agent version string.
 *
 * Used by both `index.ts` (for `createAgentApp`) and `run.ts` (for diagnostic
 * records). Centralising it here avoids drift between the two call sites.
 */
export const AGENT_VERSION = "1.0.0" as const;
