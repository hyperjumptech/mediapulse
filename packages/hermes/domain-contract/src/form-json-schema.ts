import { z } from "zod";

export const defaultTitleForFormFieldKey = (fieldKey: string): string => {
  const spaced = fieldKey.replace(/([A-Z])/g, " $1").trim();
  const lower = spaced.toLowerCase();

  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

export type HermesFormJsonSchemaOptions = {
  titleForFieldKey?: (fieldKey: string) => string;
};

type JsonSchemaRecord = Record<string, unknown>;

type ZodJsonSchemaOverrideContext = {
  zodSchema: {
    _zod: { def: { type: string; catchall?: unknown; defaultValue?: unknown } };
  };
  jsonSchema: JsonSchemaRecord;
};

const DEFAULT_WRAPPER_TYPES = new Set(["default", "prefault"]);

const FORMATS_WITH_BUILT_IN_PATTERN = new Set(["email", "date-time", "uuid"]);

const isStringPropertyNames = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  Object.keys(value).length === 1 &&
  (value as JsonSchemaRecord).type === "string";

export const keepZodV3JsonSchemaShape = ({
  zodSchema,
  jsonSchema,
}: ZodJsonSchemaOverrideContext): void => {
  const definition = zodSchema._zod.def;
  if (
    definition.type === "object" &&
    definition.catchall === undefined &&
    jsonSchema.additionalProperties === undefined
  ) {
    jsonSchema.additionalProperties = false;
  }
  if (
    DEFAULT_WRAPPER_TYPES.has(definition.type) &&
    jsonSchema.default === undefined &&
    definition.defaultValue !== undefined
  ) {
    jsonSchema.default = JSON.parse(JSON.stringify(definition.defaultValue));
  }
  if (
    typeof jsonSchema.format === "string" &&
    FORMATS_WITH_BUILT_IN_PATTERN.has(jsonSchema.format)
  ) {
    delete jsonSchema.pattern;
  }
  if (Array.isArray(jsonSchema.oneOf) && jsonSchema.anyOf === undefined) {
    jsonSchema.anyOf = jsonSchema.oneOf;
    delete jsonSchema.oneOf;
  }
  if (isStringPropertyNames(jsonSchema.propertyNames)) {
    delete jsonSchema.propertyNames;
  }
  if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) {
    delete jsonSchema.maximum;
  }
  if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) {
    delete jsonSchema.minimum;
  }
};

const isRecord = (value: unknown): value is JsonSchemaRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const hermesFormJsonSchemaFromZod = (
  schema: z.ZodObject,
  {
    titleForFieldKey = defaultTitleForFormFieldKey,
  }: HermesFormJsonSchemaOptions = {},
): JsonSchemaRecord => {
  const raw = z.toJSONSchema(schema, {
    target: "openapi-3.0",
    io: "input",
    unrepresentable: "any",
    override: keepZodV3JsonSchemaShape as never,
  }) as JsonSchemaRecord;
  if (raw.type !== "object" || !isRecord(raw.properties)) {
    throw new Error("Expected a Zod object schema with properties");
  }
  const titledProperties = Object.fromEntries(
    Object.entries(raw.properties).map(([fieldKey, fieldSchema]) => [
      fieldKey,
      {
        ...(isRecord(fieldSchema) ? fieldSchema : {}),
        title: titleForFieldKey(fieldKey),
      },
    ]),
  );
  const required = Array.isArray(raw.required)
    ? (raw.required as string[]).filter(
        (fieldKey) =>
          (titledProperties[fieldKey] as JsonSchemaRecord | undefined)?.type !==
          "boolean",
      )
    : undefined;

  return {
    ...raw,
    properties: titledProperties,
    ...(required !== undefined ? { required } : {}),
  };
};

export const mergeHermesObjectFormProperties = (
  root: JsonSchemaRecord,
  propertiesPatch: JsonSchemaRecord,
): JsonSchemaRecord => {
  const properties = isRecord(root.properties) ? root.properties : {};

  return { ...root, properties: { ...properties, ...propertiesPatch } };
};
