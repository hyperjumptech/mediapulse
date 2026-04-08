/**
 * Builds HTML and plaintext bodies for the Hermes admin password-reset email.
 *
 * @param resetUrl - Absolute URL including opaque `token` query parameter.
 */
export const buildHermesAdminPasswordResetEmailContent = (
  resetUrl: string,
): { subject: string; text: string; html: string } => {
  const subject = "Reset your Hermes admin password";
  const text = [
    "You requested a password reset for your Hermes admin account.",
    "",
    "Open this link to choose a new password (valid for 1 hour):",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `<p>You requested a password reset for your Hermes admin account.</p>
<p><a href="${resetUrl}">Reset your password</a> (link valid for 1 hour).</p>
<p>If you did not request this, you can ignore this email.</p>`;

  return { subject, text, html };
};
