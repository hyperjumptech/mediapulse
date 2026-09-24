export const MEDIAPULSE_SENDER_NAME = "MediaPulse";

/**
 * Formats a Resend `from` value with a display name.
 *
 * Returns `address` unchanged when it already contains `<…>` (operator-supplied display name).
 * Otherwise returns `"name" <address>`, double-quoted so RFC 5322 special characters
 * such as parentheses stay part of the display-name.
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
