/**
 * Maps Prisma enum names from DMMF to `z.nativeEnum` schemas for write-body validation.
 */

import { CuratedSourceLinkType } from "@mediapulse/database";
import { z } from "zod";

const prismaEnumZodByName: Record<string, z.ZodTypeAny> = {
  CuratedSourceLinkType: z.nativeEnum(CuratedSourceLinkType),
};

/**
 * Returns a Zod schema for a Prisma enum by its schema name, when registered.
 *
 * @param enumName - Prisma enum identifier (e.g. `CuratedSourceLinkType`).
 * @returns `z.nativeEnum` for known enums, or `undefined` when not registered.
 */
export const getPrismaEnumZodSchema = (
  enumName: string,
): z.ZodTypeAny | undefined => prismaEnumZodByName[enumName];
