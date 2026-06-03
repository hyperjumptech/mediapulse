import { z } from "zod";

/**
 * Reasoning effort level for OpenAI reasoning models.
 *
 * `minimal` is gpt-5-only; `low`, `medium`, and `high` cover o-series models.
 * Validity is model-dependent. Unset means "do not send the parameter" — safe for
 * non-reasoning models such as gpt-4o-mini.
 */
export const reasoningEffortSchema = z.enum([
  "minimal",
  "low",
  "medium",
  "high",
]);

/** TypeScript type for {@link reasoningEffortSchema}. */
export type OpenAiReasoningEffort = z.infer<typeof reasoningEffortSchema>;

/**
 * Builds the `providerOptions` object required by the AI SDK when reasoning
 * effort should be sent, or returns `undefined` to omit the parameter entirely.
 *
 * @param effort - Resolved reasoning effort level, or `undefined` to omit.
 * @returns Provider options to spread into `generateObject`/`generateText`, or `undefined`.
 */
export const buildOpenAiReasoningProviderOptions = (
  effort: OpenAiReasoningEffort | undefined,
): { openai: { reasoningEffort: OpenAiReasoningEffort } } | undefined =>
  effort === undefined ? undefined : { openai: { reasoningEffort: effort } };

/** AI SDK `providerOptions` shape for OpenAI reasoning effort. */
export type OpenAiReasoningProviderOptions = NonNullable<
  ReturnType<typeof buildOpenAiReasoningProviderOptions>
>;
