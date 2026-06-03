/**
 * Builds a minimal vCard 3.0 string for the given contact.
 *
 * @param params.name - The full name (FN) to embed in the card.
 * @param params.email - The email address to embed in the card.
 * @returns A valid vCard 3.0 string with CRLF line endings.
 */
export function buildVCard(params: { name: string; email: string }): string {
  const { name, email } = params;

  return [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${name}`,
    "ORG:MediaPulse",
    `EMAIL;TYPE=INTERNET:${email}`,
    "END:VCARD",
  ].join("\r\n");
}
