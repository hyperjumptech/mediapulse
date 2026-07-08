"use client";

import { Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import { SCHEMA_FORM_NEW_ENTRY_KEY } from "./schema-form-constants";
import {
  applySchemaDefaults,
  defaultForSchema,
  getSchemaFormType,
  getUnionVariants,
  orderedPropertyEntries,
  resolveUnionVariant,
  seedNewArrayItem,
} from "./schema-form-utils";
import { useRecordEntryDraftKey } from "./use-record-entry-draft-key";
import { useSchemaFormSeed } from "./use-schema-form-seed";
import { useSchemaFormTouch } from "./use-schema-form-touch";
import type { JsonSchema, SchemaFormProps, StringFieldProps } from "./types";

const getType = getSchemaFormType;

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

/** Words that should render fully uppercased in labels (e.g. apiKey → "API Key"). */
const LABEL_ACRONYMS: Record<string, string> = {
  ai: "AI",
  api: "API",
  http: "HTTP",
  id: "ID",
  json: "JSON",
  llm: "LLM",
  ttl: "TTL",
  url: "URL",
};

/**
 * Turns a camelCase or snake_case property name into a readable label (e.g. baseUrl → "Base URL").
 */
function humanize(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const acronym = LABEL_ACRONYMS[word.toLowerCase()];
      if (acronym) return acronym;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

type SchemaFormComponents = SchemaFormProps["components"];

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
  components,
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
  components?: SchemaFormComponents;
}) => {
  const { draftKey, setDraftKey, handleBlur } =
    useRecordEntryDraftKey(onKeyChange);
  return (
    <div className="grid gap-2 rounded-md border border-border/80 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isNew ? (
          <div className="grid min-w-[120px] flex-1 gap-1.5">
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
          variant="destructive"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          aria-label={isNew ? "Cancel new entry" : `Remove ${entryKey}`}
        >
          <Trash2 />
        </Button>
      </div>
      <SchemaField
        name="value"
        schema={valueSchema}
        value={value}
        onChange={onValueChange}
        disabled={disabled}
        path={path}
        components={components}
      />
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
  components,
}: {
  name: string;
  schema: JsonSchema;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  path: string;
  /** When true, label shows required indicator. */
  isRequired?: boolean;
  /** Optional custom components (e.g. StringField). */
  components?: SchemaFormComponents;
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

  const unionVariants = getUnionVariants(schema);
  if (unionVariants) {
    const resolved = resolveUnionVariant(unionVariants, value);
    if (resolved) {
      const { discriminator, options, activeSchema } = resolved;
      const obj =
        value != null && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      const currentDiscriminatorValue =
        typeof obj[discriminator] === "string"
          ? (obj[discriminator] as string)
          : (options[0]?.value ?? "");
      const discriminatorId = `${id}_${discriminator}`;
      const discriminatorSchema = activeSchema.properties?.[discriminator];
      const handleDiscriminatorChange = (nextValue: string) => {
        const nextIndex =
          options.find((option) => option.value === nextValue)?.index ?? 0;
        const nextVariant = unionVariants[nextIndex] ?? unionVariants[0];
        const seeded = defaultForSchema(nextVariant);
        const base =
          seeded != null && typeof seeded === "object" && !Array.isArray(seeded)
            ? (seeded as Record<string, unknown>)
            : {};
        onChange({ ...base, [discriminator]: nextValue });
      };
      const handleFieldChange = (key: string, v: unknown) => {
        onChange({ ...obj, [key]: v });
      };
      const otherEntries = orderedPropertyEntries(activeSchema).filter(
        ([key]) => key !== discriminator,
      );
      return (
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={discriminatorId}>{humanize(discriminator)}</Label>
            <select
              id={discriminatorId}
              value={currentDiscriminatorValue}
              onChange={(e) => handleDiscriminatorChange(e.target.value)}
              disabled={disabled}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value}
                </option>
              ))}
            </select>
            {discriminatorSchema?.description ? (
              <p className="text-muted-foreground text-xs">
                {discriminatorSchema.description}
              </p>
            ) : null}
          </div>
          {otherEntries.map(([key, propSchema]) => (
            <SchemaField
              key={key}
              name={key}
              schema={propSchema}
              value={obj[key]}
              onChange={(v) => handleFieldChange(key, v)}
              disabled={disabled}
              path={`${path}.${key}`}
              isRequired={activeSchema.required?.includes(key)}
              components={components}
            />
          ))}
        </div>
      );
    }
  }

  if (type === "object" && valueSchema && !schema.properties) {
    const obj =
      value != null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const entries = Object.entries(obj).filter(
      ([k]) => k !== SCHEMA_FORM_NEW_ENTRY_KEY,
    );
    const hasNewRow = obj[SCHEMA_FORM_NEW_ENTRY_KEY] !== undefined;
    const handleAdd = () => {
      onChange({
        ...obj,
        [SCHEMA_FORM_NEW_ENTRY_KEY]: defaultForSchema(valueSchema),
      });
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
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="grid gap-1">
            <Label className="text-sm font-medium">{title}</Label>
            {description ? (
              <p className="text-muted-foreground text-xs">{description}</p>
            ) : null}
          </div>
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
        <div className="grid gap-3">
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
              components={components}
            />
          ))}
          {hasNewRow ? (
            <RecordEntryRow
              entryKey={SCHEMA_FORM_NEW_ENTRY_KEY}
              value={obj[SCHEMA_FORM_NEW_ENTRY_KEY]}
              valueSchema={valueSchema}
              disabled={disabled}
              path={`${path}.${SCHEMA_FORM_NEW_ENTRY_KEY}`}
              onKeyChange={(newKey) =>
                handleKeyChange(SCHEMA_FORM_NEW_ENTRY_KEY, newKey)
              }
              onValueChange={(v) =>
                handleValueChange(SCHEMA_FORM_NEW_ENTRY_KEY, v)
              }
              onRemove={() => handleRemove(SCHEMA_FORM_NEW_ENTRY_KEY)}
              isNew
              components={components}
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

    if (format === "textarea") {
      return (
        <div className="grid gap-1.5">
          <Label htmlFor={id}>{labelText}</Label>
          <textarea
            id={id}
            rows={6}
            value={str}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              "flex min-h-[120px] w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
              "outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
      );
    }

    if (
      (schema.enum == null || schema.enum.length === 0) &&
      components?.StringField != null
    ) {
      const StringField = components.StringField;
      const stringFieldProps: StringFieldProps = {
        value: str,
        onChange: (v: string) => onChange(v),
        schema,
        name,
        path,
        id,
        labelText,
        description,
        disabled,
      };
      return <StringField {...stringFieldProps} />;
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
      <div className="grid gap-3">
        <div className="grid gap-1">
          <Label className="text-sm font-medium">{title}</Label>
          {description ? (
            <p className="text-muted-foreground text-xs">{description}</p>
          ) : null}
        </div>
        <div className="grid gap-4 rounded-md border border-border/80 bg-muted/20 p-3">
          {orderedPropertyEntries(schema).map(([k, propSchema]) => (
            <SchemaField
              key={k}
              name={k}
              schema={propSchema}
              value={obj[k]}
              onChange={(v) => handleChange(k, v)}
              disabled={disabled}
              path={`${path}.${k}`}
              isRequired={schema.required?.includes(k)}
              components={components}
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
      onChange([...arr, seedNewArrayItem(itemSchema)]);
    };
    const handleRemove = (index: number) => {
      const next = arr.filter((_, i) => i !== index);
      onChange(next);
    };
    return (
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="grid gap-1">
            <Label className="text-sm font-medium">{title}</Label>
            {description ? (
              <p className="text-muted-foreground text-xs">{description}</p>
            ) : null}
          </div>
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
        <div className="grid gap-3">
          {arr.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No entries yet. Use Add to create one.
            </p>
          ) : null}
          {arr.map((item, index) => (
            <div
              key={index}
              className="grid gap-2 rounded-md border border-border/80 bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-medium">
                  Item {index + 1}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  aria-label={`Remove item ${index + 1}`}
                >
                  <Trash2 />
                </Button>
              </div>
              <SchemaField
                name={`${name}[${index}]`}
                schema={itemSchema}
                value={item}
                onChange={(v) => handleItemChange(index, v)}
                disabled={disabled}
                path={`${path}[${index}]`}
                components={components}
              />
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
  components,
}: SchemaFormProps) => {
  const type = getType(schema);
  const noopOnChange = React.useCallback(() => undefined, []);
  const effectiveValue = React.useMemo(
    () => (seedRequiredDefaults ? applySchemaDefaults(schema, value) : value),
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
      {orderedPropertyEntries(schema).map(([key, propSchema]) => (
        <SchemaField
          key={key}
          name={key}
          schema={propSchema}
          value={effectiveValue[key]}
          onChange={(v) => handleChange(key, v)}
          disabled={disabled}
          path={key}
          isRequired={schema.required?.includes(key)}
          components={components}
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
