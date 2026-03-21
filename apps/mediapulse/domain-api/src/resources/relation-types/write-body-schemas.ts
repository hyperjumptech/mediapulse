/**
 * Zod write bodies and derived Hermes JSON Schemas for relation types (from Prisma `RelationType` + allowlist).
 */

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import { hermesFormJsonSchemaFromZod } from "../../lib/hermes-form-json-schema-from-zod";
import { buildWriteBodySchema } from "../../lib/prisma-write-schema/build-write-body-schema";
import type { ListItem } from "./list-mapper";

const relationTypeWriteFields = [
  "name",
  "description",
] as const satisfies ReadonlyArray<keyof ListItem>;

const relationTypeWriteBodySchemaBuilt = buildWriteBodySchema({
  metadata: prismaWriteFieldMetadata,
  model: "RelationType",
  fields: relationTypeWriteFields,
});

/** Validated JSON body for `POST /` (Hermes create). */
export const relationTypeCreateBodySchema = relationTypeWriteBodySchemaBuilt;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const relationTypeUpdateBodySchema = relationTypeCreateBodySchema;

/** Hermes `createSchema` slice derived from {@link relationTypeCreateBodySchema}. */
export const relationTypeCreateFormJsonSchema = hermesFormJsonSchemaFromZod(
  relationTypeCreateBodySchema,
);

/** Hermes `updateSchema` slice derived from {@link relationTypeUpdateBodySchema}. */
export const relationTypeUpdateFormJsonSchema = hermesFormJsonSchemaFromZod(
  relationTypeUpdateBodySchema,
);
