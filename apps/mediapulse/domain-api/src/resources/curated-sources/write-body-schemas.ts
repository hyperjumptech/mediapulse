/**
 * Zod write bodies and derived Hermes JSON Schemas for curated sources (from Prisma `CuratedSource`).
 */

import { z } from "zod";

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import { hermesFormJsonSchemaFromZod } from "../../lib/hermes-form-json-schema-from-zod";
import { buildWriteBodySchema } from "../../lib/prisma-write-schema/build-write-body-schema";

/** Writable form fields for curated-source create and update. */
const curatedSourceWriteFields = [
  "name",
  "listingUrl",
  "enabled",
  "maxItems",
] as const;

const curatedSourceWriteBodySchemaBuilt = buildWriteBodySchema({
  metadata: prismaWriteFieldMetadata,
  model: "CuratedSource",
  fields: curatedSourceWriteFields,
  fieldOverrides: {
    listingUrl: z.string().trim().min(1),
    maxItems: z.number().int().positive().nullable().optional(),
  },
});

/** Validated JSON body for `POST /` (Hermes create). */
export const curatedSourceCreateBodySchema = curatedSourceWriteBodySchemaBuilt;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const curatedSourceUpdateBodySchema = curatedSourceCreateBodySchema;

/** Hermes `createSchema` slice derived from {@link curatedSourceCreateBodySchema}. */
export const curatedSourceCreateFormJsonSchema = hermesFormJsonSchemaFromZod(
  curatedSourceCreateBodySchema,
);

/** Hermes `updateSchema` slice derived from {@link curatedSourceUpdateBodySchema}. */
export const curatedSourceUpdateFormJsonSchema = hermesFormJsonSchemaFromZod(
  curatedSourceUpdateBodySchema,
);
