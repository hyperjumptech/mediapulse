import { createHash } from "node:crypto";

/**
 * Computes a deterministic short hash of the exact prompts sent to the LLM.
 *
 * Algorithm: SHA-256(systemPrompt + "\n\n" + resolvedUserPrompt) → first 16 hex chars.
 *
 * The hash captures the concatenation of both prompt strings **after**
 * placeholder substitution (i.e. `{{sourceSummaries}}`, `{{tickerId}}`, and
 * `{{date}}` have already been resolved), so any change to either the prompt
 * template or the source content will produce a different hash.
 *
 * @param systemPrompt - The system-role prompt sent to the model.
 * @param resolvedUserPrompt - The user-role prompt after all placeholder substitution.
 * @returns 16-character hex string uniquely identifying the prompt pair.
 */
export function computePromptHash(
  systemPrompt: string,
  resolvedUserPrompt: string,
): string {
  const combined = `${systemPrompt}\n\n${resolvedUserPrompt}`;
  return createHash("sha256").update(combined).digest("hex").slice(0, 16);
}
