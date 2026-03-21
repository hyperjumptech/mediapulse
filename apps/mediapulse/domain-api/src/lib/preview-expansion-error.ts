/** Max length for preview-expansion error strings returned to Hermes (admin UI). */
export const MAX_PREVIEW_EXPANSION_ERROR_LEN = 800;

/**
 * Trims and caps error text for preview API responses.
 *
 * @param message - Raw error message.
 * @returns Safe-length string for JSON `error` field.
 */
export const truncatePreviewExpansionError = (message: string): string => {
  const trimmed = message.trim();
  if (trimmed.length <= MAX_PREVIEW_EXPANSION_ERROR_LEN) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_PREVIEW_EXPANSION_ERROR_LEN)}…`;
};
