/**
 * Maps `MediapulseUser` rows to list items for the mediapulse-users Hermes table API.
 */

import type { Language, Prisma } from "@mediapulse/database";

/** Prisma row shape for list queries that include subscription languages. */
export type MediapulseUserListRow = Prisma.MediapulseUserGetPayload<{
  include: { userTickers: { select: { language: true } } };
}>;

const languageSortOrder: Record<Language, number> = {
  en: 0,
  id: 1,
};

/**
 * Returns a human-readable label for a newsletter language code.
 *
 * @param language - Prisma `Language` enum value.
 * @returns Display label for Hermes table cells.
 */
export const formatLanguageLabel = (language: Language): string => {
  if (language === "id") return "Indonesian";
  return "English";
};

/**
 * Aggregates distinct subscription languages for a user into a comma-separated label.
 *
 * @param userTickers - User subscriptions with language selected from Prisma.
 * @returns Sorted, deduplicated language labels, or `"—"` when there are no subscriptions.
 */
export const formatUserLanguages = (
  userTickers: Array<{ language: Language }>,
): string => {
  const uniqueLanguages = [
    ...new Set(userTickers.map((subscription) => subscription.language)),
  ].sort(
    (left, right) => languageSortOrder[left] - languageSortOrder[right],
  );

  if (uniqueLanguages.length === 0) {
    return "—";
  }

  return uniqueLanguages.map(formatLanguageLabel).join(", ");
};

/**
 * Maps a Prisma Mediapulse user row to the JSON list item.
 *
 * @param row - Row from `prisma.mediapulseUser.findMany` with `userTickers.language`.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: MediapulseUserListRow) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  enabled: row.enabled ? "Yes" : "No",
  languages: formatUserLanguages(row.userTickers),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
