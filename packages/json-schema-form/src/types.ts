/**
 * Minimal JSON Schema type for form rendering (no $ref).
 * Covers types used by zod-to-json-schema with $refStrategy: "none".
 */
export type JsonSchemaTypeName =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array";

/**
 * JSON Schema for a single type (object shape used by agent config schemas).
 */
export interface JsonSchema {
  type?: JsonSchemaTypeName | JsonSchemaTypeName[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  /** List of required property names (for object schemas). */
  required?: string[];
  /** Schema for dynamic keys (e.g. z.record()); when set, object is edited as key-value entries. */
  additionalProperties?: JsonSchema | boolean;
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
}

/**
 * Props for the SchemaForm component.
 */
export interface SchemaFormProps {
  /** JSON Schema root (typically type "object" with properties). */
  schema: JsonSchema;
  /** Current form value (object). */
  value: Record<string, unknown>;
  /** Called when the user changes the value. */
  onChange: (value: Record<string, unknown>) => void;
  /** Optional validation; if provided, errors can be shown. */
  validate?: (
    value: Record<string, unknown>,
  ) => { valid: true } | { valid: false; errors: string[] };
  /** Whether the form is disabled. */
  disabled?: boolean;
  /** Optional class name for the root element. */
  className?: string;
}
