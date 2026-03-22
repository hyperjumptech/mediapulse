/**
 * Parses optional ticker `metadata` from API JSON (string or object) into Prisma JSON input or errors.
 */

import type { Prisma } from "@mediapulse/database";

/** Result of parsing optional ticker metadata from a dashboard JSON body. */
export type ParseTickerMetadataResult =
  | { ok: true; value: Prisma.InputJsonValue | null | undefined }
  | { ok: false; message: string };

/**
 * Parses optional `metadata` from Hermes table-v1 forms (JSON in a textarea) or raw JSON bodies.
 * Empty or whitespace-only strings become `null` (clear stored JSON).
 *
 * @param raw - Value from `metadata` in the request body.
 * @returns Parsed JSON for Prisma, or an error message when the string is not valid JSON.
 */
export const parseTickerMetadataJson = (
  raw: unknown,
): ParseTickerMetadataResult => {
  if (raw === undefined) {
    return { ok: true, value: undefined };
  }
  if (raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return { ok: true, value: null };
    }
    try {
      const parsed = JSON.parse(trimmed) as Prisma.InputJsonValue;
      return { ok: true, value: parsed };
    } catch {
      return { ok: false, message: "metadata must be valid JSON" };
    }
  }
  if (typeof raw === "object") {
    return { ok: true, value: raw as Prisma.InputJsonValue };
  }
  return {
    ok: false,
    message: "metadata must be a JSON string or object",
  };
};
