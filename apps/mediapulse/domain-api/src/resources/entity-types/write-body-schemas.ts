/**
 * Zod write bodies and derived Hermes JSON Schemas for entity types (from Prisma `EntityType` + allowlist).
 */

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import { hermesFormJsonSchemaFromZod } from "../../lib/hermes-form-json-schema-from-zod";
import { buildWriteBodySchema } from "../../lib/prisma-write-schema/build-write-body-schema";
import type { ListItem } from "./list-mapper";

/** Writable form fields must be keys of {@link ListItem} so the manifest cannot drift from the table. */
const entityTypeWriteFields = [
  "name",
  "description",
] as const satisfies ReadonlyArray<keyof ListItem>;

const entityTypeWriteBodySchemaBuilt = buildWriteBodySchema({
  metadata: prismaWriteFieldMetadata,
  model: "EntityType",
  fields: entityTypeWriteFields,
});

/** Validated JSON body for `POST /` (Hermes create). */
export const entityTypeCreateBodySchema = entityTypeWriteBodySchemaBuilt;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const entityTypeUpdateBodySchema = entityTypeCreateBodySchema;

/** Hermes `createSchema` slice derived from {@link entityTypeCreateBodySchema}. */
export const entityTypeCreateFormJsonSchema = hermesFormJsonSchemaFromZod(
  entityTypeCreateBodySchema,
);

/** Hermes `updateSchema` slice derived from {@link entityTypeUpdateBodySchema}. */
export const entityTypeUpdateFormJsonSchema = hermesFormJsonSchemaFromZod(
  entityTypeUpdateBodySchema,
);
