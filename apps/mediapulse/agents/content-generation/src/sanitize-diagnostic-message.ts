/** Maximum character length for the `detail` portion of a diagnostic message. */
const MAX_DETAIL_LENGTH = 200;

/**
 * Pattern that matches common secret prefixes found in API keys and config
 * values. Used to redact any `detail` string that accidentally contains a
 * secret before it reaches the diagnostic record.
 *
 * Matched patterns: `sk-`, `apiKey`, `api_key`, `Bearer <token>`, `token=<value>`.
 */
const SECRET_PATTERN =
  /sk-[A-Za-z0-9]+|apiKey[^\s]*|api_key[^\s]*|Bearer\s+\S+|token=[^\s&]*/gi;

/**
 * Parts used to construct a sanitized diagnostic message.
 */
export type SanitizeDiagnosticMessageParts = {
  /** The ticker ID for the current invocation — always included. */
  tickerId: string;
  /** Outcome code string (omitted on success). */
  outcomeCode?: string;
  /** Pipeline stage string (omitted on success). */
  stage?: string;
  /**
   * Optional supplemental detail appended after the fixed fields.
   *
   * **Never** pass raw error objects, LLM responses, config values, or API
   * keys here. Only pass safe, static human-readable strings.
   */
  detail?: string;
};

/**
 * Constructs a sanitized diagnostic message string from safe, structured parts.
 *
 * The message is built exclusively from static strings and explicitly safe
 * values (`tickerId`, `outcomeCode`, `stage`). The optional `detail` field is
 * truncated and scanned for common secret patterns before inclusion.
 *
 * **Secret-safety rule:** Never pass raw error messages, LLM responses,
 * `config.openai.apiKey`, or any full config object as `detail`. Use only
 * static human-readable strings.
 *
 * Example output:
 * - `"tickerId=abc123 outcome=openai_retry_exhausted stage=llm: retries exhausted"`
 * - `"tickerId=abc123 outcome=success"`
 *
 * @param parts - Structured parts from which to build the message.
 * @returns A sanitized, human-readable diagnostic message string.
 */
export function sanitizeDiagnosticMessage(
  parts: SanitizeDiagnosticMessageParts,
): string {
  const { tickerId, outcomeCode, stage, detail } = parts;

  let message = `tickerId=${tickerId}`;

  if (outcomeCode !== undefined) {
    message += ` outcome=${outcomeCode}`;
  }

  if (stage !== undefined) {
    message += ` stage=${stage}`;
  }

  if (detail !== undefined && detail.length > 0) {
    const truncated =
      detail.length > MAX_DETAIL_LENGTH
        ? `${detail.slice(0, MAX_DETAIL_LENGTH)}...`
        : detail;

    const redacted = truncated.replace(SECRET_PATTERN, "[REDACTED]");
    message += `: ${redacted}`;
  }

  return message;
}
