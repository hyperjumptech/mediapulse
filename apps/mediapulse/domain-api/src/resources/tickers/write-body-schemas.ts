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

const tickerMetadataRawBodySchema = z
  .union([z.string(), z.record(z.string(), z.unknown()), z.null()])
  .optional();

const tickerScalarWriteFields = [
  "symbol",
  "name",
  "sector",
  "industry",
  "subSector",
  "subIndustry",
  "businessActivity",
] as const satisfies ReadonlyArray<keyof ListItem>;

const tickerScalarWriteBodySchemaBuilt = buildWriteBodySchema({
  metadata: prismaWriteFieldMetadata,
  model: "Ticker",
  fields: tickerScalarWriteFields,
});

const tickerWriteBodySchemaBuilt = tickerScalarWriteBodySchemaBuilt
  .extend({
    metadataRaw: tickerMetadataRawBodySchema,
  })
  .strict();

/** Validated JSON body for `POST /` (Hermes create). */
export const tickerCreateBodySchema = tickerWriteBodySchemaBuilt;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const tickerUpdateBodySchema = tickerCreateBodySchema;

const tickerMetadataRawJsonProperty = {
  type: "object",
  title: "Metadata (raw IDX blob)",
  nullable: true,
  properties: tickerMetadataFormProperties,
} as const;

/** Human-friendly titles for the structured classification columns. */
const tickerFieldTitles: Record<string, string> = {
  symbol: "Symbol",
  name: "Name",
  sector: "Sector",
  industry: "Industry",
  subSector: "Sub-sector",
  subIndustry: "Sub-industry",
  businessActivity: "Business activity",
};

const titleForTickerFieldKey = (fieldKey: string): string =>
  tickerFieldTitles[fieldKey] ?? defaultTitleForFormFieldKey(fieldKey);

/** Hermes `createSchema` slice: Zod-derived scalars + raw IDX metadata field layout. */
export const tickerCreateFormJsonSchema = mergeHermesObjectFormProperties(
  hermesFormJsonSchemaFromZod(tickerCreateBodySchema, {
    titleForFieldKey: titleForTickerFieldKey,
  }),
  { metadataRaw: tickerMetadataRawJsonProperty },
);

/** Hermes `updateSchema` slice (same as create for this resource). */
export const tickerUpdateFormJsonSchema = mergeHermesObjectFormProperties(
  hermesFormJsonSchemaFromZod(tickerUpdateBodySchema, {
    titleForFieldKey: titleForTickerFieldKey,
  }),
  { metadataRaw: tickerMetadataRawJsonProperty },
);
