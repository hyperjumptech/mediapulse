import { hermesFormJsonSchemaFromZod } from "@hermes/domain-contract";
import type { Prisma } from "@mediapulse/database";

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import { buildWriteBodySchema } from "../../lib/prisma-write-schema/build-write-body-schema";
import type { ListItem } from "./list-mapper";

const tickerWriteFields = ["symbol", "name"] as const satisfies ReadonlyArray<
  keyof ListItem
>;

export const tickerCreateBodySchema = buildWriteBodySchema<
  Pick<Prisma.TickerCreateInput, (typeof tickerWriteFields)[number]>
>({
  metadata: prismaWriteFieldMetadata,
  model: "Ticker",
  fields: tickerWriteFields,
});

export const tickerUpdateBodySchema = tickerCreateBodySchema;

export const tickerCreateFormJsonSchema = hermesFormJsonSchemaFromZod(
  tickerCreateBodySchema,
);

export const tickerUpdateFormJsonSchema = hermesFormJsonSchemaFromZod(
  tickerUpdateBodySchema,
);
