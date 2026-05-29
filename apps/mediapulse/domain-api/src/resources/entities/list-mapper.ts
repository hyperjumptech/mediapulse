/**
 * Prisma `include` for entity list/detail rows and mappers to list items and detail payloads.
 */

import type { Prisma } from "@mediapulse/database";

/** Max characters of `description` included in list rows (full text on GET by id). */
export const ENTITY_DESCRIPTION_PREVIEW_MAX = 200;

/**
 * `include` passed to `entity.findMany` / `findUnique` for list and detail views.
 */
export const listInclude = {
  type: {
    select: {
      name: true,
    },
  },
} satisfies Prisma.EntityInclude;

/**
 * Prisma row shape for `entity.findMany` when loading the list view.
 */
export type ListRow = Prisma.EntityGetPayload<{
  include: typeof listInclude;
}>;

/**
 * Truncates plain text for a list preview (ellipsis when longer than max).
 *
 * @param description - Raw `Entity.description` or null.
 * @param max - Maximum characters before truncation.
 * @returns Preview string or null when input is null.
 */
export const truncateDescriptionPreview = (
  description: string | null,
  max: number,
): string | null => {
  if (description === null) {
    return null;
  }
  if (description.length <= max) {
    return description;
  }
  return `${description.slice(0, max)}…`;
};

/**
 * Maps an entity row (with type) to the JSON list item.
 *
 * @param row - Row from `prisma.entity.findMany` using {@link listInclude}.
 * @returns Serializable list row for the domain API.
 */
export const mapRowToListItem = (row: ListRow) => ({
  id: row.id,
  canonicalName: row.canonicalName,
  entityTypeName: row.type.name,
  descriptionPreview: truncateDescriptionPreview(
    row.description,
    ENTITY_DESCRIPTION_PREVIEW_MAX,
  ),
  createdAt: row.createdAt.toISOString(),
});

/** JSON list item type; derived from {@link mapRowToListItem}. */
export type ListItem = ReturnType<typeof mapRowToListItem>;
