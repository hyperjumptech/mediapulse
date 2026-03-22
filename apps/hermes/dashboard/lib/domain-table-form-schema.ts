/**
 * JSON Schema subset supported by Hermes table-v1 create/update forms:
 *
 * - Root: `{ type: "object", properties: Record<string, JsonSchemaProperty>, required?: string[] }`
 * - `required` lists property keys that must be submitted.
 * - Nullable optional fields: `nullable: true`, or `anyOf` / `type` array including `"null"`.
 * - `string`: optional `format` of `"date-time"` (datetime-local input) or `"textarea"` (multiline).
 * - `number` / `integer`: numeric input; `integer` uses whole numbers in the JSON payload.
 * - `boolean`: checkbox; unchecked is coerced to `false`.
 * - `enum`: string options only; rendered as `<select>`.
 * - `object` with non-empty `properties`: grouped nested inputs; form names use dot paths (`parent.child`).
 * - `object` without properties (or empty): falls back to a single textarea (raw JSON string).
 *
 * Unknown or non-object `properties` entries are skipped.
 */

/** One dynamic field for a domain table create/update form. */
export type DomainTableFormField =
  | DomainTableFormStringField
  | DomainTableFormNumberField
  | DomainTableFormBooleanField
  | DomainTableFormEnumField
  | DomainTableObjectField;

export type DomainTableFormStringField = {
  kind: "string";
  key: string;
  label: string;
  required: boolean;
  nullable: boolean;
  format?: "date-time" | "textarea";
};

export type DomainTableFormNumberField = {
  kind: "number";
  key: string;
  label: string;
  required: boolean;
  nullable: boolean;
  integer: boolean;
};

export type DomainTableFormBooleanField = {
  kind: "boolean";
  key: string;
  label: string;
  required: boolean;
};

export type DomainTableFormEnumField = {
  kind: "enum";
  key: string;
  label: string;
  required: boolean;
  nullable: boolean;
  options: string[];
};

export type DomainTableObjectField = {
  kind: "object";
  key: string;
  label: string;
  required: boolean;
  nullable: boolean;
  properties: DomainTableFormField[];
};

/**
 * Parses JSON Schema object `properties` into ordered field descriptors for Hermes forms.
 *
 * @param schema - Root schema object from domain `createSchema` / `updateSchema`.
 * @returns Field descriptors in `properties` iteration order.
 */
export const parseDomainTableFormFieldsFromJsonSchema = (
  schema: unknown,
): DomainTableFormField[] => {
  if (!schema || typeof schema !== "object") return [];
  const root = schema as {
    properties?: unknown;
    required?: unknown;
  };
  const properties = root.properties;
  if (!properties || typeof properties !== "object" || properties === null) {
    return [];
  }
  const requiredList = Array.isArray(root.required)
    ? root.required.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  const requiredSet = new Set(requiredList);

  return Object.entries(properties as Record<string, unknown>)
    .map(([key, value]) => parsePropertyField(key, value, requiredSet))
    .filter((entry): entry is DomainTableFormField => entry !== null);
};

/**
 * Converts submitted form data into a JSON body for domain POST/PATCH using field descriptors.
 *
 * @param formData - Browser `FormData` from the create or edit form.
 * @param fields - Parsed field descriptors for this form.
 * @returns Payload object (excluding keys starting with `__`, handled by callers if present).
 */
export const formDataToDomainPayload = (
  formData: FormData,
  fields: DomainTableFormField[],
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const coerced = coerceTopLevelField(field, formData, "");
    if (coerced !== undefined) {
      payload[field.key] = coerced;
    }
  }
  return payload;
};

/**
 * Parses a table row cell into a plain object for nested JSON object fields.
 * Accepts JSON strings (from list APIs) or already-parsed objects.
 *
 * @param value - Cell value from a list row.
 * @returns Plain object for defaulting child inputs.
 */
export const parseJsonObjectRow = (value: unknown): Record<string, unknown> => {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (t === "") return {};
    try {
      const p = JSON.parse(t);
      if (typeof p === "object" && p !== null && !Array.isArray(p)) {
        return p as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
};

/**
 * Returns a display default for edit forms (native input `defaultValue` / `defaultChecked`).
 *
 * @param field - Parsed field descriptor.
 * @param row - Table row values from the list API.
 * @returns String for text-like controls, boolean for checkbox.
 */
export const getDomainTableFieldEditDefault = (
  field: DomainTableFormField,
  row: Record<string, unknown>,
): string | boolean => {
  const raw = row[field.key];
  switch (field.kind) {
    case "boolean":
      return Boolean(raw);
    case "number": {
      if (raw === null || raw === undefined) return "";
      if (typeof raw === "number" && !Number.isNaN(raw)) return String(raw);
      return String(raw ?? "");
    }
    case "enum": {
      if (raw === null || raw === undefined) return "";
      return String(raw);
    }
    case "string": {
      if (raw === null || raw === undefined) return "";
      const s = String(raw);
      if (field.format === "date-time") {
        return isoLikeToDatetimeLocalValue(s);
      }
      return s;
    }
    case "object":
      return "";
  }
};

/**
 * Converts an ISO-like instant string to `datetime-local` input value (local wall time).
 *
 * @param iso - ISO-8601 string or empty.
 * @returns Value suitable for `input[type=datetime-local]`, or empty when unparseable.
 */
export const isoLikeToDatetimeLocalValue = (iso: string): string => {
  if (!iso.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const propertyIsNullable = (property: Record<string, unknown>): boolean => {
  if (property.nullable === true) return true;
  if (Array.isArray(property.anyOf)) {
    return property.anyOf.some(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: unknown }).type === "null",
    );
  }
  if (Array.isArray(property.type)) {
    return property.type.includes("null");
  }
  return false;
};

const mergeEffectiveProperty = (
  property: Record<string, unknown>,
): Record<string, unknown> => {
  if (Array.isArray(property.anyOf)) {
    const candidate = property.anyOf.find(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        (entry as { type?: unknown }).type !== "null",
    );
    if (candidate && typeof candidate === "object") {
      return { ...property, ...(candidate as Record<string, unknown>) };
    }
  }
  if (Array.isArray(property.type)) {
    const nonNull = property.type.find((t) => t !== "null");
    if (nonNull !== undefined) {
      return { ...property, type: nonNull };
    }
  }
  return property;
};

const parsePropertyField = (
  key: string,
  property: unknown,
  requiredKeys: Set<string>,
): DomainTableFormField | null => {
  if (typeof property !== "object" || property === null) return null;
  const raw = property as Record<string, unknown>;
  const nullable = propertyIsNullable(raw);
  const schema = mergeEffectiveProperty(raw);

  const label =
    typeof schema.title === "string" && schema.title.length > 0
      ? schema.title
      : key;
  const required = requiredKeys.has(key);

  if (
    Array.isArray(schema.enum) &&
    schema.enum.length > 0 &&
    schema.enum.every((entry) => typeof entry === "string")
  ) {
    return {
      kind: "enum",
      key,
      label,
      required,
      nullable,
      options: schema.enum as string[],
    };
  }

  const type = schema.type;
  if (type === "boolean") {
    return { kind: "boolean", key, label, required };
  }
  if (type === "number" || type === "integer") {
    return {
      kind: "number",
      key,
      label,
      required,
      nullable,
      integer: type === "integer",
    };
  }
  if (type === "string") {
    const format = schema.format;
    const stringFormat =
      format === "date-time" || format === "textarea" ? format : undefined;
    return {
      kind: "string",
      key,
      label,
      required,
      nullable,
      format: stringFormat,
    };
  }

  if (type === "object") {
    const props = schema.properties;
    if (props && typeof props === "object" && props !== null) {
      const innerRequired = Array.isArray(schema.required)
        ? schema.required.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [];
      const innerRequiredSet = new Set(innerRequired);
      const children = Object.entries(props as Record<string, unknown>)
        .map(([childKey, childProp]) =>
          parsePropertyField(childKey, childProp, innerRequiredSet),
        )
        .filter((entry): entry is DomainTableFormField => entry !== null);
      if (children.length > 0) {
        return {
          kind: "object",
          key,
          label,
          required,
          nullable,
          properties: children,
        };
      }
    }
    return {
      kind: "string",
      key,
      label,
      required,
      nullable,
      format: "textarea",
    };
  }

  return {
    kind: "string",
    key,
    label,
    required,
    nullable,
    format: undefined,
  };
};

const coerceTopLevelField = (
  field: DomainTableFormField,
  formData: FormData,
  pathPrefix: string,
): unknown | undefined => {
  const path = pathPrefix ? `${pathPrefix}.${field.key}` : field.key;

  if (field.kind === "object") {
    return coerceObjectFieldFromForm(field, formData, path);
  }

  const raw = formData.get(path);
  return coerceFieldValue(field, raw);
};

const coerceObjectFieldFromForm = (
  field: DomainTableObjectField,
  formData: FormData,
  pathPrefix: string,
): unknown | undefined => {
  const out: Record<string, unknown> = {};
  for (const child of field.properties) {
    const childPath = `${pathPrefix}.${child.key}`;
    if (child.kind === "object") {
      const nested = coerceObjectFieldFromForm(child, formData, childPath);
      if (nested !== undefined) {
        out[child.key] = nested;
      }
    } else {
      const raw = formData.get(childPath);
      const v = coerceFieldValue(child, raw);
      if (v !== undefined) {
        out[child.key] = v;
      }
    }
  }

  if (Object.keys(out).length === 0) {
    if (field.nullable) return {};
    return undefined;
  }
  return out;
};

type DomainTableLeafFormField = Exclude<
  DomainTableFormField,
  DomainTableObjectField
>;

const coerceFieldValue = (
  field: DomainTableLeafFormField,
  raw: FormDataEntryValue | null,
): unknown | undefined => {
  const str = raw === null || raw === undefined ? "" : String(raw);

  if (field.kind === "boolean") {
    return str === "true";
  }

  if (field.kind === "number") {
    const trimmed = str.trim();
    if (trimmed === "") {
      if (field.required) {
        return 0;
      }
      if (field.nullable) return null;
      return undefined;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      if (field.required) {
        return 0;
      }
      return field.nullable ? null : undefined;
    }
    return field.integer ? Math.trunc(n) : n;
  }

  if (field.kind === "enum") {
    const trimmedEnum = str.trim();
    if (trimmedEnum === "") {
      if (field.required && field.options.length > 0) {
        return field.options[0];
      }
      if (field.nullable) return null;
      return undefined;
    }
    return trimmedEnum;
  }

  const trimmed = str.trim();
  if (trimmed === "") {
    if (field.required) {
      return "";
    }
    if (field.nullable) return null;
    return undefined;
  }
  return trimmed;
};
