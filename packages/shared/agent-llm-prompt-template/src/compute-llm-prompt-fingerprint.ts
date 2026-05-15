import { createHash } from "node:crypto";

/**
 * Computes a deterministic short fingerprint of the exact prompts sent to an LLM.
 *
 * Algorithm: SHA-256(`systemPrompt` + "\n\n" + `resolvedUserPrompt`) → first 16 hex chars.
 * Matches content-generation provenance `promptHash` semantics (MP-CGA-008).
 *
 * @param systemPrompt - The system-role prompt sent to the model.
 * @param resolvedUserPrompt - The user-role prompt after placeholder substitution.
 * @returns 16-character hex string identifying the prompt pair.
 */
export const computeLlmPromptFingerprint = (
  systemPrompt: string,
  resolvedUserPrompt: string,
): string => {
  const combined = `${systemPrompt}\n\n${resolvedUserPrompt}`;
  return createHash("sha256").update(combined).digest("hex").slice(0, 16);
};
