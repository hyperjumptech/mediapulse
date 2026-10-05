import { hermesFormJsonSchemaFromZod } from "@hermes/domain-contract";
import { z } from "zod";

export const publisherUpdateBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
  })
  .strict();

export const publisherUpdateFormJsonSchema = hermesFormJsonSchemaFromZod(
  publisherUpdateBodySchema,
);
