import { createHash } from "node:crypto";

import Ajv, {
  type ErrorObject,
  type JSONSchemaType,
  type ValidateFunction,
} from "ajv";
import addFormats from "ajv-formats";

import { configSchemaFingerprint } from "./config-schema-fingerprint";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

/**
 * Hermes UI-only JSON Schema format for multiline prompt fields
 * ({@link enrichConfigSchemaForHermesUi} in @workspace/agent-runtime).
 */
ajv.addFormat("textarea", {
  type: "string",
  validate: () => true,
});

/**
 * Hermes UI-only annotation keyword recording declared field order
 * ({@link enrichConfigSchemaForHermesUi} in @workspace/agent-runtime). No-op for validation.
 */
ajv.addKeyword({ keyword: "propertyOrder" });

const VARIABLE_PLACEHOLDER_REGEX = /\{\{[^{}]+\}\}/;

const EXACT_RUN_PARAM_PLACEHOLDER_REGEX = /^\{\{\s*params\.[^{}]+\}\}$/;

const PLACEHOLDER_DEFERRED_KEYWORDS = new Set(["format", "pattern"]);

const VALIDATOR_CACHE_CAPACITY = 256;

type CachedValidator = {
  schema: Record<string, unknown>;
  validate: ValidateFunction;
};

const validatorCache = new Map<string, CachedValidator>();

const schemaCacheKey = (schema: Record<string, unknown>): string => {
  const fingerprint = configSchemaFingerprint(schema);

  return createHash("sha256").update(fingerprint).digest("hex");
};

const readCachedValidator = (
  cacheKey: string,
): ValidateFunction | undefined => {
  const cached = validatorCache.get(cacheKey);
  if (cached === undefined) {
    return undefined;
  }
  validatorCache.delete(cacheKey);
  validatorCache.set(cacheKey, cached);

  return cached.validate;
};

const evictLeastRecentlyUsedValidator = (): void => {
  const oldestEntry = validatorCache.entries().next();
  if (oldestEntry.done === true) {
    return;
  }
  const [oldestKey, oldestValidator] = oldestEntry.value;
  validatorCache.delete(oldestKey);
  ajv.removeSchema(oldestValidator.schema);
};

const storeCachedValidator = (
  cacheKey: string,
  cachedValidator: CachedValidator,
): void => {
  validatorCache.set(cacheKey, cachedValidator);
  while (validatorCache.size > VALIDATOR_CACHE_CAPACITY) {
    evictLeastRecentlyUsedValidator();
  }
};

const findValidatorRegisteredForSchemaId = (
  schema: Record<string, unknown>,
): ValidateFunction | undefined => {
  const schemaId = schema.$id;
  if (typeof schemaId !== "string") {
    return undefined;
  }

  return ajv.getSchema(schemaId);
};

const compileSchema = (schema: Record<string, unknown>): ValidateFunction => {
  try {
    return ajv.compile(schema as JSONSchemaType<unknown>);
  } catch (error) {
    ajv.removeSchema(schema);
    throw error;
  }
};

const getValidator = (schema: Record<string, unknown>): ValidateFunction => {
  const cacheKey = schemaCacheKey(schema);
  const cachedValidator = readCachedValidator(cacheKey);
  if (cachedValidator !== undefined) {
    return cachedValidator;
  }
  const registeredValidator = findValidatorRegisteredForSchemaId(schema);
  if (registeredValidator !== undefined) {
    return registeredValidator;
  }
  const ownedSchema = structuredClone(schema);
  const validate = compileSchema(ownedSchema);
  storeCachedValidator(cacheKey, { schema: ownedSchema, validate });

  return validate;
};

function resolveInstancePath(data: unknown, instancePath: string): unknown {
  if (instancePath === "") {
    return data;
  }

  let current: unknown = data;
  for (const rawSegment of instancePath.slice(1).split("/")) {
    if (current === null || typeof current !== "object") {
      return undefined;
    }
    const segment = rawSegment.replace(/~1/g, "/").replace(/~0/g, "~");
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isDeferredPlaceholderError(
  error: ErrorObject,
  data: unknown,
): boolean {
  const value = resolveInstancePath(data, error.instancePath);
  if (typeof value !== "string") {
    return false;
  }
  if (EXACT_RUN_PARAM_PLACEHOLDER_REGEX.test(value)) {
    return true;
  }
  if (!PLACEHOLDER_DEFERRED_KEYWORDS.has(error.keyword)) {
    return false;
  }

  return VARIABLE_PLACEHOLDER_REGEX.test(value);
}

/**
 * Validates data against a JSON Schema.
 *
 * @param schema - JSON Schema object (e.g. from agent registry).
 * @param data - Data to validate.
 * @returns Object with valid: true, or valid: false and errors array.
 */
export function validateWithJsonSchema(
  schema: Record<string, unknown>,
  data: unknown,
): { valid: true } | { valid: false; errors: string[] } {
  try {
    const validate = getValidator(schema);
    const ok = validate(data);
    if (ok) return { valid: true };
    const remaining = (validate.errors ?? []).filter(
      (error) => !isDeferredPlaceholderError(error, data),
    );
    if (remaining.length === 0) return { valid: true };
    const errors = remaining.map((e) =>
      `${e.instancePath || "/"} ${e.message ?? "validation failed"}`.trim(),
    );
    return { valid: false, errors };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, errors: [message] };
  }
}
