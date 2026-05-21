/**
 * Zod write bodies and Hermes JSON Schemas for entity-relation create/update forms.
 */

import { z } from "zod";

import { hermesFormJsonSchemaFromZod } from "../../lib/hermes-form-json-schema-from-zod";

/** Shared writable fields for POST and PATCH (canonical names + weight). */
const entityRelationWriteBodySchema = z
  .object({
    fromEntityName: z.string().trim().min(1),
    toEntityName: z.string().trim().min(1),
    relationTypeName: z.string().trim().min(1),
    weight: z.number().positive(),
  })
  .strict();

/** Validated JSON body for `POST /` (Hermes create). */
export const entityRelationCreateBodySchema = entityRelationWriteBodySchema;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const entityRelationUpdateBodySchema = entityRelationWriteBodySchema;

/** Hermes `createSchema` slice derived from {@link entityRelationCreateBodySchema}. */
export const entityRelationCreateFormJsonSchema = hermesFormJsonSchemaFromZod(
  entityRelationCreateBodySchema,
);

/** Hermes `updateSchema` slice derived from {@link entityRelationUpdateBodySchema}. */
export const entityRelationUpdateFormJsonSchema = hermesFormJsonSchemaFromZod(
  entityRelationUpdateBodySchema,
);
