"use client";

import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import type { JsonSchema, SchemaFormProps } from "./types.js";

/**
 * Resolves the effective schema type (single type name) when schema.type is a string or array.
 */
function getType(schema: JsonSchema): JsonSchema["type"] {
  const t = schema.type;
  if (Array.isArray(t)) return t[0];
  return t;
}

/**
 * Returns a default value for a schema (used to seed required keys so submission passes validation).
 * For objects with required + properties, seeds those keys so nested validation passes.
 */
function defaultForSchema(schema: JsonSchema): unknown {
  if (schema.default !== undefined) return schema.default;
  const type = getType(schema);
  if (type === "object") {
    const obj: Record<string, unknown> = {};
    if (schema.required?.length && schema.properties) {
      for (const key of schema.required) {
        const prop = schema.properties[key];
        if (prop) obj[key] = defaultForSchema(prop);
      }
    }
    return obj;
  }
  if (type === "array") return [];
  if (type === "string") {
    if (schema.enum != null && schema.enum.length > 0) return schema.enum[0];
    return "";
  }
  if (type === "number" || type === "integer") return 0;
  if (type === "boolean") return false;
  return undefined;
}

/**
 * Merges value with empty defaults for any required keys that are missing.
 * Ensures submitted config includes required properties (e.g. webSearch, webFetch) so server validation passes.
 */
function applyRequiredDefaults(
  schema: JsonSchema,
  value: Record<string, unknown>,
): Record<string, unknown> {
  if (!schema.properties || !schema.required?.length) return value;
  let changed = false;
  const result = { ...value };
  for (const key of schema.required) {
    if (result[key] === undefined) {
      const propSchema = schema.properties[key];
      if (propSchema) {
        result[key] = defaultForSchema(propSchema);
        changed = true;
      }
    }
  }
  return changed ? result : value;
}

/** Placeholder key for "new" record entry until user types a real key. */
const NEW_ENTRY_KEY = "__new__";

/**
 * Converts an ISO date-time string to YYYY-MM-DDTHH:mm for datetime-local input (local time).
 */
function isoToDatetimeLocal(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/**
 * Converts a datetime-local value (YYYY-MM-DDTHH:mm) to RFC 3339 ISO string.
 */
function datetimeLocalToIso(local: string): string {
  if (!local || local.length < 16) return local;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  return d.toISOString();
}

/**
 * Turns a camelCase property name into a readable label (e.g. baseUrl → "Base URL").
 */
function humanize(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Draft key state for a new record entry row. Commits on blur when non-empty.
 */
const useRecordEntryDraftKey = (onKeyChange: (newKey: string) => void) => {
  const [draftKey, setDraftKey] = React.useState("");
  const handleBlur = React.useCallback(() => {
    const k = draftKey.trim();
    if (k !== "" && k !== NEW_ENTRY_KEY) onKeyChange(k);
  }, [draftKey, onKeyChange]);
  return { draftKey, setDraftKey, handleBlur };
};

/**
 * Seeds parent value with required schema keys when missing (runs once per missing-required change).
 */
const useSchemaFormSeed = (
  schema: JsonSchema,
  value: Record<string, unknown>,
  onChange: (v: Record<string, unknown>) => void,
) => {
  const type = getType(schema);
  React.useEffect(() => {
    if (type !== "object" || !schema.properties || !schema.required?.length)
      return;
    const missingRequired = schema.required.some((k) => value[k] === undefined);
    if (!missingRequired) return;
    const merged = applyRequiredDefaults(schema, value);
    onChange(merged);
  }, [schema, type, value, onChange]);
};

/**
 * Touch state for validation-on-blur.
 */
const useSchemaFormTouch = () => {
  const [touched, setTouched] = React.useState(false);
  return { touched, setTouched };
};

/**
 * One key-value row in a record (additionalProperties) editor.
 */
const RecordEntryRow = ({
  entryKey,
  value,
  valueSchema,
  disabled,
  path,
  onKeyChange,
  onValueChange,
  onRemove,
  isNew = false,
}: {
  entryKey: string;
  value: unknown;
  valueSchema: JsonSchema;
  disabled?: boolean;
  path: string;
  onKeyChange: (newKey: string) => void;
  onValueChange: (v: unknown) => void;
  onRemove: () => void;
  isNew?: boolean;
}) => {
  const { draftKey, setDraftKey, handleBlur } =
    useRecordEntryDraftKey(onKeyChange);
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {isNew ? (
          <div className="grid gap-1.5 flex-1 min-w-[120px]">
            <Label className="text-xs">Key</Label>
            <Input
              placeholder="e.g. serper-dev"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              onBlur={handleBlur}
              disabled={disabled}
              className="h-8"
            />
          </div>
        ) : (
          <span className="font-mono text-sm font-medium">{entryKey}</span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={disabled}
          aria-label={isNew ? "Cancel new entry" : `Remove ${entryKey}`}
        >
          Remove
        </Button>
      </div>
      <div className="grid gap-2">
        <SchemaField
          name="value"
          schema={valueSchema}
          value={value}
          onChange={onValueChange}
          disabled={disabled}
          path={path}
        />
      </div>
    </div>
  );
};

/**
 * Renders a single field based on schema type and updates the parent object at the given key.
 */
const SchemaField = ({
  name,
  schema,
  value,
  onChange,
  disabled,
  path,
  isRequired = false,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  path: string;
  /** When true, label shows required indicator. */
  isRequired?: boolean;
}) => {
  const type = getType(schema);
  const title = schema.title ?? humanize(name);
  const description = schema.description;
  const id = path.replace(/\./g, "_");
  const labelText = isRequired ? `${title} *` : title;
  const valueSchema =
    schema.additionalProperties &&
    typeof schema.additionalProperties === "object"
      ? schema.additionalProperties
      : null;

  if (type === "object" && valueSchema && !schema.properties) {
    const obj =
      value != null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const entries = Object.entries(obj).filter(([k]) => k !== NEW_ENTRY_KEY);
    const hasNewRow = obj[NEW_ENTRY_KEY] !== undefined;
    const handleAdd = () => {
      onChange({ ...obj, [NEW_ENTRY_KEY]: defaultForSchema(valueSchema) });
    };
    const handleRemove = (key: string) => {
      const next = { ...obj };
      delete next[key];
      onChange(next);
    };
    const handleKeyChange = (oldKey: string, newKey: string) => {
      if (newKey === oldKey) return;
      const next = { ...obj };
      const v = next[oldKey];
      delete next[oldKey];
      if (newKey.trim() !== "") next[newKey.trim()] = v;
      onChange(next);
    };
    const handleValueChange = (key: string, v: unknown) => {
      onChange({ ...obj, [key]: v });
    };
    return (
      <div className="mt-4 space-y-4 rounded-md border border-border/80 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{title}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={disabled}
          >
            Add entry
          </Button>
        </div>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
        <div className="grid gap-4">
          {entries.map(([key]) => (
            <RecordEntryRow
              key={key}
              entryKey={key}
              value={obj[key]}
              valueSchema={valueSchema}
              disabled={disabled}
              path={`${path}.${key}`}
              onKeyChange={(newKey) => handleKeyChange(key, newKey)}
              onValueChange={(v) => handleValueChange(key, v)}
              onRemove={() => handleRemove(key)}
            />
          ))}
          {hasNewRow ? (
            <RecordEntryRow
              entryKey={NEW_ENTRY_KEY}
              value={obj[NEW_ENTRY_KEY]}
              valueSchema={valueSchema}
              disabled={disabled}
              path={`${path}.${NEW_ENTRY_KEY}`}
              onKeyChange={(newKey) => handleKeyChange(NEW_ENTRY_KEY, newKey)}
              onValueChange={(v) => handleValueChange(NEW_ENTRY_KEY, v)}
              onRemove={() => handleRemove(NEW_ENTRY_KEY)}
              isNew
            />
          ) : null}
        </div>
      </div>
    );
  }

  if (type === "string") {
    const str = typeof value === "string" ? value : "";
    const format = schema.format;

    if (format === "date") {
      const dateValue = str && str.length >= 10 ? str.slice(0, 10) : "";
      return (
        <div className="grid gap-1.5">
          <Label htmlFor={id}>{labelText}</Label>
          <Input
            id={id}
            type="date"
            value={dateValue}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
      );
    }

    if (format === "date-time") {
      const localValue = isoToDatetimeLocal(str);
      return (
        <div className="grid gap-1.5">
          <Label htmlFor={id}>{labelText}</Label>
          <Input
            id={id}
            type="datetime-local"
            value={localValue}
            onChange={(e) => onChange(datetimeLocalToIso(e.target.value))}
            disabled={disabled}
          />
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{labelText}</Label>
        {schema.enum != null && schema.enum.length > 0 ? (
          <select
            id={id}
            value={str}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          >
            {schema.enum.map((opt) => (
              <option key={String(opt)} value={String(opt)}>
                {String(opt)}
              </option>
            ))}
          </select>
        ) : (
          <Input
            id={id}
            type="text"
            value={str}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        )}
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
    );
  }

  if (type === "number" || type === "integer") {
    const num =
      typeof value === "number" && !Number.isNaN(value)
        ? value
        : type === "integer"
          ? 0
          : 0;
    return (
      <div className="grid gap-1.5">
        <Label htmlFor={id}>{labelText}</Label>
        <Input
          id={id}
          type="number"
          step={type === "integer" ? 1 : undefined}
          value={num}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || v === "-") onChange(0);
            else onChange(type === "integer" ? parseInt(v, 10) : parseFloat(v));
          }}
          disabled={disabled}
        />
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
    );
  }

  if (type === "boolean") {
    const bool = value === true;
    return (
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={bool}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-input"
        />
        <Label htmlFor={id} className="font-normal">
          {labelText}
        </Label>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
    );
  }

  if (type === "object" && schema.properties) {
    const obj =
      value != null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const handleChange = (key: string, v: unknown) => {
      onChange({ ...obj, [key]: v });
    };
    return (
      <div className="mt-4 space-y-4 rounded-md border border-border/80 bg-muted/20 p-4">
        <Label className="text-sm font-medium">{title}</Label>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
        <div className="grid gap-4">
          {Object.entries(schema.properties).map(([k, propSchema]) => (
            <SchemaField
              key={k}
              name={k}
              schema={propSchema}
              value={obj[k]}
              onChange={(v) => handleChange(k, v)}
              disabled={disabled}
              path={`${path}.${k}`}
              isRequired={schema.required?.includes(k)}
            />
          ))}
        </div>
      </div>
    );
  }

  if (type === "array" && schema.items) {
    const arr = Array.isArray(value) ? value : [];
    const itemSchema = schema.items;
    const handleItemChange = (index: number, v: unknown) => {
      const next = [...arr];
      next[index] = v;
      onChange(next);
    };
    const handleAdd = () => {
      const def = itemSchema.default;
      const empty =
        getType(itemSchema) === "object"
          ? {}
          : getType(itemSchema) === "string"
            ? ""
            : getType(itemSchema) === "number" ||
                getType(itemSchema) === "integer"
              ? 0
              : getType(itemSchema) === "boolean"
                ? false
                : null;
      onChange([...arr, def !== undefined ? def : empty]);
    };
    const handleRemove = (index: number) => {
      const next = arr.filter((_, i) => i !== index);
      onChange(next);
    };
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{title}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={disabled}
          >
            Add
          </Button>
        </div>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
        <div className="space-y-2">
          {arr.map((item, index) => (
            <div
              key={index}
              className="flex gap-2 items-start rounded-md border p-2"
            >
              <div className="flex-1 min-w-0">
                <SchemaField
                  name={`${name}[${index}]`}
                  schema={itemSchema}
                  value={item}
                  onChange={(v) => handleItemChange(index, v)}
                  disabled={disabled}
                  path={`${path}[${index}]`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label={`Remove item ${index + 1}`}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

/**
 * Renders a form from a JSON Schema (object with properties).
 * Supports nested objects and arrays. Controlled component: value and onChange are required.
 *
 * @param props - Schema, value, onChange, and optional validate, disabled, className.
 * @returns Form UI for the schema.
 */
export const SchemaForm = ({
  schema,
  value,
  onChange,
  validate,
  disabled = false,
  seedRequiredDefaults = true,
  className,
}: SchemaFormProps) => {
  const type = getType(schema);
  const noopOnChange = React.useCallback(() => undefined, []);
  const effectiveValue = React.useMemo(
    () => (seedRequiredDefaults ? applyRequiredDefaults(schema, value) : value),
    [schema, value, seedRequiredDefaults],
  );
  useSchemaFormSeed(
    schema,
    value,
    seedRequiredDefaults ? onChange : noopOnChange,
  );
  const { touched, setTouched } = useSchemaFormTouch();
  const errors = React.useMemo(
    () =>
      touched && validate ? validate(effectiveValue) : { valid: true as const },
    [touched, validate, effectiveValue],
  );
  const errorList = errors.valid === false ? errors.errors : [];

  const handleChange = React.useCallback(
    (key: string, v: unknown) => {
      onChange({ ...effectiveValue, [key]: v });
    },
    [effectiveValue, onChange],
  );

  if (type !== "object" || !schema.properties) {
    return (
      <p className="text-muted-foreground text-sm">
        Schema must be an object with properties.
      </p>
    );
  }

  return (
    <div className={cn("space-y-6", className)} onBlur={() => setTouched(true)}>
      {Object.entries(schema.properties).map(([key, propSchema]) => (
        <SchemaField
          key={key}
          name={key}
          schema={propSchema}
          value={effectiveValue[key]}
          onChange={(v) => handleChange(key, v)}
          disabled={disabled}
          path={key}
          isRequired={schema.required?.includes(key)}
        />
      ))}
      {errorList.length > 0 ? (
        <ul
          className="text-destructive text-sm list-disc list-inside"
          role="alert"
        >
          {errorList.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};
