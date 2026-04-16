/**
 * Normalizes an entity name or alias for case-insensitive matching.
 * Must stay aligned with `normalizeAnalysisName` in agent-data-api `services/analysis.ts`.
 *
 * @param value - Raw string from the LLM or API.
 * @returns Trimmed lowercase string.
 */
export const normalizeEntityName = (value: string): string =>
  value.trim().toLowerCase();
