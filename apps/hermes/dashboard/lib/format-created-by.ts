type CreatorLike = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
} | null;

/**
 * Formats creator identity for dashboard audit displays.
 *
 * @param creator - Optional creator relation object.
 * @param createdById - Optional fallback id when relation is not loaded/resolved.
 * @returns Display name, then email, then id, then em dash.
 */
export const formatCreatedBy = (
  creator: CreatorLike,
  createdById?: string | null,
): string => {
  const name = creator?.name?.trim();
  if (name) return name;
  const email = creator?.email?.trim();
  if (email) return email;
  const id = createdById ?? creator?.id;
  return id && id.trim().length > 0 ? id : "—";
};
