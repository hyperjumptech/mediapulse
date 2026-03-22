/**
 * Zod write bodies and derived Hermes JSON Schemas for tickers (Prisma `Ticker` scalars + IDX metadata typing).
 */

import { z } from "zod";

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import {
  defaultTitleForFormFieldKey,
  hermesFormJsonSchemaFromZod,
  mergeHermesObjectFormProperties,
} from "../../lib/hermes-form-json-schema-from-zod";
import { buildWriteBodySchema } from "../../lib/prisma-write-schema/build-write-body-schema";
import type { ListItem } from "./list-mapper";
import { tickerMetadataFormProperties } from "./lib/metadata-form-properties";

const tickerMetadataBodySchema = z
  .union([z.string(), z.record(z.string(), z.unknown()), z.null()])
  .optional();

const tickerScalarWriteFields = [
  "symbol",
  "name",
] as const satisfies ReadonlyArray<keyof ListItem>;

const tickerScalarWriteBodySchemaBuilt = buildWriteBodySchema({
  metadata: prismaWriteFieldMetadata,
  model: "Ticker",
  fields: tickerScalarWriteFields,
});

const tickerWriteBodySchemaBuilt = tickerScalarWriteBodySchemaBuilt
  .extend({
    metadata: tickerMetadataBodySchema,
  })
  .strict();

/** Validated JSON body for `POST /` (Hermes create). */
export const tickerCreateBodySchema = tickerWriteBodySchemaBuilt;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const tickerUpdateBodySchema = tickerCreateBodySchema;

const tickerMetadataJsonProperty = {
  type: "object",
  title: "Metadata",
  nullable: true,
  properties: tickerMetadataFormProperties,
} as const;

/** Hermes `createSchema` slice: Zod-derived scalars + IDX metadata field layout. */
export const tickerCreateFormJsonSchema = mergeHermesObjectFormProperties(
  hermesFormJsonSchemaFromZod(tickerCreateBodySchema, {
    titleForFieldKey: (fieldKey: string) =>
      fieldKey === "symbol"
        ? "Symbol"
        : fieldKey === "name"
          ? "Name"
          : defaultTitleForFormFieldKey(fieldKey),
  }),
  { metadata: tickerMetadataJsonProperty },
);

/** Hermes `updateSchema` slice (same as create for this resource). */
export const tickerUpdateFormJsonSchema = mergeHermesObjectFormProperties(
  hermesFormJsonSchemaFromZod(tickerUpdateBodySchema, {
    titleForFieldKey: (fieldKey: string) =>
      fieldKey === "symbol"
        ? "Symbol"
        : fieldKey === "name"
          ? "Name"
          : defaultTitleForFormFieldKey(fieldKey),
  }),
  { metadata: tickerMetadataJsonProperty },
);
