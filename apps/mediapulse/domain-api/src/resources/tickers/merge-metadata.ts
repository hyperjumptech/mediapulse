/**
 * PATCH-time merge helper for ticker `metadata` JSON: preserve keys omitted from the dashboard form.
 */

import { Prisma } from "@mediapulse/database";

/**
 * Shallow-merges incoming metadata from the dashboard into existing JSON so keys not present
 * in the form (e.g. from IDX import) are preserved on PATCH.
 *
 * @param existing - Current `metadata` column value.
 * @param incoming - Parsed body `metadata` (object, string, null, or undefined to skip).
 * @returns Value for Prisma `update`, or `undefined` to leave the column unchanged.
 */
export const mergeTickerMetadataForPatch = (
  existing: unknown,
  incoming: Prisma.InputJsonValue | null | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined => {
  if (incoming === undefined) {
    return undefined;
  }
  if (incoming === null) {
    return Prisma.DbNull;
  }
  if (typeof incoming === "string") {
    return incoming as Prisma.InputJsonValue;
  }
  if (
    typeof incoming !== "object" ||
    incoming === null ||
    Array.isArray(incoming)
  ) {
    return incoming as Prisma.InputJsonValue;
  }
  const base =
    existing !== null &&
    existing !== undefined &&
    typeof existing === "object" &&
    !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  return {
    ...base,
    ...(incoming as Record<string, unknown>),
  } as Prisma.InputJsonValue;
};
