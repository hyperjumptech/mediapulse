/**
 * Zod write bodies and derived Hermes JSON Schemas for data-source expansions (from Prisma `DataSourceExpansion` + allowlist).
 */

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import { hermesFormJsonSchemaFromZod } from "../../lib/hermes-form-json-schema-from-zod";
import { buildWriteBodySchema } from "../../lib/prisma-write-schema/build-write-body-schema";
import type { ListItem } from "./list-mapper";

const dataSourceExpansionWriteFields = [
  "name",
  "expansionString",
  "description",
] as const satisfies ReadonlyArray<keyof ListItem>;

const dataSourceExpansionWriteBodySchemaBuilt = buildWriteBodySchema({
  metadata: prismaWriteFieldMetadata,
  model: "DataSourceExpansion",
  fields: dataSourceExpansionWriteFields,
});

/** Validated JSON body for `POST /` (Hermes create). */
export const dataSourceExpansionCreateBodySchema =
  dataSourceExpansionWriteBodySchemaBuilt;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const dataSourceExpansionUpdateBodySchema =
  dataSourceExpansionCreateBodySchema;

/** Hermes `createSchema` slice derived from {@link dataSourceExpansionCreateBodySchema}. */
export const dataSourceExpansionCreateFormJsonSchema =
  hermesFormJsonSchemaFromZod(dataSourceExpansionCreateBodySchema);

/** Hermes `updateSchema` slice derived from {@link dataSourceExpansionUpdateBodySchema}. */
export const dataSourceExpansionUpdateFormJsonSchema =
  hermesFormJsonSchemaFromZod(dataSourceExpansionUpdateBodySchema);
