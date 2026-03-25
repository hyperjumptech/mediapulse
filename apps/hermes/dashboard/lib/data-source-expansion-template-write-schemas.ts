/**
 * Zod write bodies and derived JSON Schemas for Hermes-managed data source expansion templates.
 */

import { z } from "zod";

import { hermesFormJsonSchemaFromZod } from "./hermes-form-json-schema-from-zod";

/** Validated JSON body for creating template rows (matches former domain-api shape). */
export const dataSourceExpansionTemplateCreateBodySchema = z.object({
  name: z.string().min(1),
  expansionString: z.string().min(1),
  description: z.string().nullable().optional(),
});

/** Validated JSON body for updating template rows. */
export const dataSourceExpansionTemplateUpdateBodySchema =
  dataSourceExpansionTemplateCreateBodySchema;

/** Hermes `createSchema` slice for table-v1 full-page create. */
export const dataSourceExpansionTemplateCreateFormJsonSchema =
  hermesFormJsonSchemaFromZod(dataSourceExpansionTemplateCreateBodySchema);

/** Hermes `updateSchema` slice for table-v1 full-page edit. */
export const dataSourceExpansionTemplateUpdateFormJsonSchema =
  hermesFormJsonSchemaFromZod(dataSourceExpansionTemplateUpdateBodySchema);
