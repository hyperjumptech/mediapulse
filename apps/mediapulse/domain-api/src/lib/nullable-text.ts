/**
 * Converts optional string values to nullable trimmed values.
 *
 * @param value - Optional string or null.
 * @returns Trimmed string or null.
 */
export const nullableText = (
  value: string | null | undefined,
): string | null => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};
