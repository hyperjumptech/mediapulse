import { computeLlmPromptFingerprint } from "@workspace/agent-llm-prompt-template";

/**
 * Computes a deterministic short hash of the exact prompts sent to the LLM.
 *
 * Delegates to {@link computeLlmPromptFingerprint} from `@workspace/agent-llm-prompt-template`
 * so all agents share one algorithm (MP-CGA-008, REQ-011).
 *
 * @param systemPrompt - The system-role prompt sent to the model.
 * @param resolvedUserPrompt - The user-role prompt after all placeholder substitution.
 * @returns 16-character hex string uniquely identifying the prompt pair.
 */
export function computePromptHash(
  systemPrompt: string,
  resolvedUserPrompt: string,
): string {
  return computeLlmPromptFingerprint(systemPrompt, resolvedUserPrompt);
}
