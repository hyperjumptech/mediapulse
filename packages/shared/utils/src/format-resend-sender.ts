export const MEDIAPULSE_SENDER_NAME = "CEO (Chief Email Officer) - MediaPulse";

/**
 * Formats a Resend `from` value with a display name.
 *
 * Returns `address` unchanged when it already contains `<…>` (operator-supplied display name).
 * Otherwise returns `"name" <address>` — the name is double-quoted because it contains
 * parentheses, which RFC 5322 treats as comment delimiters in an unquoted display-name.
 *
 * @param address - The sender email address (bare or already formatted).
 * @param name - Display name to prepend. Defaults to {@link MEDIAPULSE_SENDER_NAME}.
 */
export function formatResendSender(
  address: string,
  name: string = MEDIAPULSE_SENDER_NAME,
): string {
  if (address.includes("<")) {
    return address;
  }

  return `"${name}" <${address}>`;
}
