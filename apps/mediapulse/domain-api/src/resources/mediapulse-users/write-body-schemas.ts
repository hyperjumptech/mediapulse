/**
 * Zod write bodies and derived Hermes JSON Schemas for Mediapulse users (from Prisma `MediapulseUser` + allowlist + email override).
 */

import { z } from "zod";

import { prismaWriteFieldMetadata } from "../../generated/prisma-write-field-metadata";
import {
  defaultTitleForFormFieldKey,
  hermesFormJsonSchemaFromZod,
} from "../../lib/hermes-form-json-schema-from-zod";
import { buildWriteBodySchema } from "../../lib/prisma-write-schema/build-write-body-schema";
import type { ListItem } from "./list-mapper";

const mediapulseUserWriteFields = [
  "email",
  "name",
  "enabled",
] as const satisfies ReadonlyArray<keyof ListItem>;

const mediapulseUserWriteBodySchemaBuilt = buildWriteBodySchema({
  metadata: prismaWriteFieldMetadata,
  model: "MediapulseUser",
  fields: mediapulseUserWriteFields,
  fieldOverrides: {
    email: z.string().email(),
  },
});

/** Validated JSON body for `POST /` (Hermes create). */
export const mediapulseUserCreateBodySchema =
  mediapulseUserWriteBodySchemaBuilt;

/** Validated JSON body for `PATCH /:id` (Hermes update). */
export const mediapulseUserUpdateBodySchema = mediapulseUserCreateBodySchema;

const mediapulseUserTitleForFieldKey = (fieldKey: string): string => {
  if (fieldKey === "email") {
    return "Email";
  }
  return defaultTitleForFormFieldKey(fieldKey);
};

/**
 * Adds `format: "email"` to the email property for Hermes widgets (Zod email does not always emit format).
 *
 * @param root - Object JSON Schema from {@link hermesFormJsonSchemaFromZod}.
 */
const withEmailFormat = (
  root: Record<string, unknown>,
): Record<string, unknown> => {
  const props = root.properties as Record<string, Record<string, unknown>>;
  return {
    ...root,
    properties: {
      ...props,
      email: { ...props.email, format: "email" },
    },
  };
};

/** Hermes `createSchema` slice derived from {@link mediapulseUserCreateBodySchema}. */
export const mediapulseUserCreateFormJsonSchema = withEmailFormat(
  hermesFormJsonSchemaFromZod(mediapulseUserCreateBodySchema, {
    titleForFieldKey: mediapulseUserTitleForFieldKey,
  }),
);

/** Hermes `updateSchema` slice derived from {@link mediapulseUserUpdateBodySchema}. */
export const mediapulseUserUpdateFormJsonSchema = withEmailFormat(
  hermesFormJsonSchemaFromZod(mediapulseUserUpdateBodySchema, {
    titleForFieldKey: mediapulseUserTitleForFieldKey,
  }),
);
