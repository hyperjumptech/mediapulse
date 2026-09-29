import { z } from "zod";

export const RUN_PARAMS_PLACEHOLDER_PREFIX = "params.";
export const RUN_PARAMS_MAX_KEYS = 32;
export const RUN_PARAMS_MAX_STRING_LENGTH = 2048;
export const RUN_PARAMS_MAX_SERIALIZED_BYTES = 16 * 1024;

const RUN_PARAM_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
const EXACT_RUN_PARAM_PLACEHOLDER = /^\{\{\s*params\.([^{}]+?)\s*\}\}$/;
const EMBEDDED_RUN_PARAM_PLACEHOLDER = /\{\{\s*params\.([^{}]+?)\s*\}\}/g;

export type RunParamValue = string | number | boolean;

export type RunParams = Record<string, RunParamValue>;

const hasRunParam = (params: RunParams, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(params, key);

export type ParseRunParamsResult =
  | { success: true; params: RunParams }
  | { success: false; error: string };

const RunParamValueSchema = z.union([
  z.string().max(RUN_PARAMS_MAX_STRING_LENGTH),
  z.number(),
  z.boolean(),
]);

export const RunParamsSchema = z
  .record(
    z.string().regex(RUN_PARAM_KEY_PATTERN, {
      message:
        "Run parameter names start with a letter and contain only letters, digits and underscores (max 64 characters)",
    }),
    RunParamValueSchema,
  )
  .refine((params) => Object.keys(params).length <= RUN_PARAMS_MAX_KEYS, {
    message: `At most ${RUN_PARAMS_MAX_KEYS} run parameters are allowed`,
  })
  .refine(
    (params) =>
      new TextEncoder().encode(JSON.stringify(params)).length <=
      RUN_PARAMS_MAX_SERIALIZED_BYTES,
    {
      message: `Run parameters must serialize to at most ${RUN_PARAMS_MAX_SERIALIZED_BYTES} bytes`,
    },
  );

export const parseRunParams = (value: unknown): ParseRunParamsResult => {
  if (value === undefined || value === null) {
    return { success: true, params: {} };
  }
  const result = RunParamsSchema.safeParse(value);
  if (!result.success) {
    return { success: false, error: z.prettifyError(result.error) };
  }

  return { success: true, params: result.data };
};

const substituteRunParamsInString = (
  text: string,
  params: RunParams,
): unknown => {
  const exactMatch = EXACT_RUN_PARAM_PLACEHOLDER.exec(text);
  if (exactMatch) {
    const key = exactMatch[1]?.trim() ?? "";
    if (hasRunParam(params, key)) {
      return params[key];
    }

    return text;
  }

  return text.replace(EMBEDDED_RUN_PARAM_PLACEHOLDER, (placeholder, key) => {
    const trimmedKey = String(key).trim();
    if (!hasRunParam(params, trimmedKey)) {
      return placeholder;
    }

    return String(params[trimmedKey]);
  });
};

export const substituteRunParams = <T>(value: T, params: RunParams): T => {
  if (typeof value === "string") {
    return substituteRunParamsInString(value, params) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteRunParams(item, params)) as T;
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = substituteRunParams(entry, params);
    }

    return result as T;
  }

  return value;
};

const collectRunParamKeys = (value: unknown, keys: Set<string>): void => {
  if (typeof value === "string") {
    for (const match of value.matchAll(EMBEDDED_RUN_PARAM_PLACEHOLDER)) {
      keys.add(match[1]?.trim() ?? "");
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectRunParamKeys(item, keys);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value)) {
      collectRunParamKeys(entry, keys);
    }
  }
};

export const findRunParamKeys = (value: unknown): string[] => {
  const keys = new Set<string>();
  collectRunParamKeys(value, keys);

  return [...keys].sort();
};

export const isReservedVariableKey = (key: string): boolean =>
  key.trim().startsWith(RUN_PARAMS_PLACEHOLDER_PREFIX);
