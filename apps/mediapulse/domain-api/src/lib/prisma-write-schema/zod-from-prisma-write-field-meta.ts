/**
 * Builds Zod leaf schemas from compact Prisma write-field metadata (scalar / enum).
 */

import type { ZodTypeAny } from "zod";
import { z as zod } from "zod";

import type { PrismaWriteFieldMeta } from "../../generated/prisma-write-field-metadata";

export type ZodFromPrismaWriteFieldMetaCollaborators = {
  /** Resolves Prisma enums to Zod (e.g. `z.nativeEnum`). */
  getEnumSchema: (enumName: string) => ZodTypeAny | undefined;
};

/**
 * Produces a Zod schema for a single Prisma scalar or enum field from write metadata.
 *
 * @param meta - Field metadata from {@link prismaWriteFieldMetadata}.
 * @param collaborators - Injectable enum resolver for tests.
 * @returns Zod schema matching Prisma nullability and list shape.
 */
export const zodFromPrismaWriteFieldMeta = (
  meta: PrismaWriteFieldMeta,
  collaborators: ZodFromPrismaWriteFieldMetaCollaborators,
): ZodTypeAny => {
  if (meta.isList) {
    throw new Error(
      "Prisma list fields are not supported by zodFromPrismaWriteFieldMeta; use a fieldOverrides schema.",
    );
  }

  const inner = (): ZodTypeAny => {
    if (meta.kind === "enum") {
      const en = collaborators.getEnumSchema(meta.enumName);
      if (!en) {
        throw new Error(
          `No Zod schema registered for Prisma enum "${meta.enumName}". Add it in default-prisma-enum-zod.ts.`,
        );
      }
      return en;
    }

    switch (meta.type) {
      case "String": {
        const s = zod.string();
        return meta.isRequired ? s.min(1) : s;
      }
      case "Int":
        return meta.isRequired ? zod.number().int() : zod.number().int();
      case "BigInt":
        return meta.isRequired ? zod.bigint() : zod.bigint();
      case "Float":
        return meta.isRequired ? zod.number() : zod.number();
      case "Decimal":
        return meta.isRequired ? zod.number() : zod.number();
      case "Boolean":
        return meta.isRequired ? zod.boolean() : zod.boolean();
      case "DateTime":
        return meta.isRequired
          ? zod.string().datetime({ offset: true })
          : zod.string().datetime({ offset: true });
      case "Json":
        return zod.unknown();
      case "Bytes":
        return zod.instanceof(Uint8Array);
      default:
        throw new Error(
          `Unsupported Prisma scalar type for write schema: ${meta.type}`,
        );
    }
  };

  const wrapOptional = (schema: ZodTypeAny): ZodTypeAny =>
    meta.isRequired ? schema : schema.nullable().optional();

  return wrapOptional(inner());
};
