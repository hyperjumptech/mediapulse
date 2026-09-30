import { z } from "zod";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJsonText = (text: string): { parsed: unknown } | undefined => {
  try {
    return { parsed: JSON.parse(text) };
  } catch {
    return undefined;
  }
};

const jsonObjectFromValue = (
  fieldLabel: string,
  value: unknown,
  context: z.RefinementCtx,
): Record<string, unknown> => {
  if (isPlainObject(value)) {
    return value;
  }
  if (typeof value !== "string") {
    context.addIssue({
      code: "custom",
      message: `${fieldLabel} must be a JSON object`,
    });

    return z.NEVER;
  }
  const parseResult = parseJsonText(value);
  if (!parseResult) {
    context.addIssue({
      code: "custom",
      message: `Invalid JSON in ${fieldLabel}`,
    });

    return z.NEVER;
  }
  if (!isPlainObject(parseResult.parsed)) {
    context.addIssue({
      code: "custom",
      message: `${fieldLabel} must be a JSON object`,
    });

    return z.NEVER;
  }

  return parseResult.parsed;
};

export const jsonObjectFieldSchema = (fieldLabel: string) =>
  z.unknown().transform((value, context): Record<string, unknown> => {
    if (value === undefined || value === null || value === "") {
      context.addIssue({
        code: "custom",
        message: `${fieldLabel} is required`,
      });

      return z.NEVER;
    }

    return jsonObjectFromValue(fieldLabel, value, context);
  });

export const optionalJsonObjectFieldSchema = (fieldLabel: string) =>
  z
    .unknown()
    .transform((value, context): Record<string, unknown> | undefined =>
      value === undefined || value === ""
        ? undefined
        : jsonObjectFromValue(fieldLabel, value, context),
    );
