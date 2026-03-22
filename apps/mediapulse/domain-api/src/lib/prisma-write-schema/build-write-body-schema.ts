/**
 * Composes `z.object` write-body schemas from Prisma field metadata and explicit field allowlists.
 */

import type { z } from "zod";
import { z as zod } from "zod";

import type { PrismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import { getPrismaEnumZodSchema } from "./default-prisma-enum-zod";
import { zodFromPrismaWriteFieldMeta } from "./zod-from-prisma-write-field-meta";

export type BuildWriteBodySchemaInput = {
  /** DMMF-derived metadata (generated). */
  metadata: PrismaWriteFieldMetadata;
  /** Prisma model name (e.g. \`EntityType\`). */
  model: keyof PrismaWriteFieldMetadata;
  /** Writable API field names, in object key order. */
  fields: readonly string[];
  /** Per-field Zod overrides (e.g. \`z.string().email()\`, JSON unions). */
  fieldOverrides?: Record<string, z.ZodTypeAny>;
  /**
   * Resolves Prisma enum names to Zod; defaults to {@link getPrismaEnumZodSchema}.
   *
   * @param enumName - Prisma enum identifier from metadata.
   */
  getEnumSchema?: (enumName: string) => z.ZodTypeAny | undefined;
};

/**
 * Builds a Zod object schema for a create/update JSON body using Prisma types for selected fields.
 *
 * @param input - Model, allowlisted fields, optional overrides, and enum resolver.
 * @returns A {@link z.ZodObject} with `.strict()` so unknown body keys are rejected.
 */
export const buildWriteBodySchema = (
  input: BuildWriteBodySchemaInput,
): z.ZodObject<z.ZodRawShape> => {
  const getEnumSchema = input.getEnumSchema ?? getPrismaEnumZodSchema;

  const modelFields = input.metadata[input.model];
  if (!modelFields) {
    throw new Error(
      `Unknown Prisma model in write metadata: ${String(input.model)}`,
    );
  }

  const shape: z.ZodRawShape = {};

  for (const fieldName of input.fields) {
    const override = input.fieldOverrides?.[fieldName];
    if (override) {
      shape[fieldName] = override;
      continue;
    }
    const meta = modelFields[fieldName as keyof typeof modelFields];
    if (!meta) {
      throw new Error(
        `Field "${fieldName}" is not a scalar/enum on Prisma model ${String(input.model)}`,
      );
    }
    shape[fieldName] = zodFromPrismaWriteFieldMeta(meta, {
      getEnumSchema,
    });
  }

  return zod.object(shape).strict();
};
