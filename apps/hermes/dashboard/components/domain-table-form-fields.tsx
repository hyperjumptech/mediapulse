"use client";

import { useId } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

import {
  getDomainTableFieldEditDefault,
  parseJsonObjectRow,
  type DomainTableFormField,
} from "@/lib/domain-table-form-schema";

const TEXTAREA_CLASS = cn(
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
);

const SELECT_CLASS = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
);

const CHECKBOX_CLASS = "size-4 rounded border-input";

type DomainTableFormFieldsProps = {
  /** Parsed JSON Schema fields for this form. */
  fields: DomainTableFormField[];
  /** When set, initial values come from a table row (edit mode). */
  defaultRow?: Record<string, unknown>;
  /**
   * Dot-separated prefix for nested object fields (e.g. `metadata` for `metadata.Sektor`).
   */
  namePrefix?: string;
};

/**
 * Renders labels and inputs for a domain table-v1 create or edit form from JSON Schema descriptors.
 *
 * @param props - Field descriptors, optional row defaults for edit, and optional name prefix for nesting.
 * @returns Fragment of labeled controls.
 */
export const DomainTableFormFields = ({
  fields,
  defaultRow,
  namePrefix = "",
}: DomainTableFormFieldsProps) => {
  const baseId = useId();

  return (
    <>
      {fields.map((field) => {
        const path = namePrefix ? `${namePrefix}.${field.key}` : field.key;
        const fieldId = `${baseId}-${path}`;

        if (field.kind === "object") {
          const childRow = parseJsonObjectRow(defaultRow?.[field.key]);
          const nextPrefix = path;
          return (
            <Card key={path} className="gap-0 overflow-hidden py-0 shadow-sm">
              <CardHeader className="border-b bg-muted/40 px-4 py-3">
                <CardTitle className="text-base">{field.label}</CardTitle>
                <CardDescription>
                  Structured fields; values are sent as JSON under{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    {field.key}
                  </code>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 px-4 py-4">
                <DomainTableFormFields
                  fields={field.properties}
                  defaultRow={childRow}
                  namePrefix={nextPrefix}
                />
              </CardContent>
            </Card>
          );
        }

        const editDefault = defaultRow
          ? getDomainTableFieldEditDefault(field, defaultRow)
          : undefined;

        if (field.kind === "boolean") {
          const checked =
            defaultRow !== undefined ? (editDefault as boolean) : false;
          return (
            <div key={path} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={fieldId}
                name={path}
                value="true"
                defaultChecked={checked}
                required={field.required}
                className={CHECKBOX_CLASS}
              />
              <Label
                htmlFor={fieldId}
                className="cursor-pointer text-sm font-normal"
              >
                {field.label}
              </Label>
            </div>
          );
        }

        if (field.kind === "number") {
          const defaultValue =
            defaultRow !== undefined && typeof editDefault === "string"
              ? editDefault
              : undefined;
          return (
            <div key={path} className="grid gap-1 text-sm">
              <Label htmlFor={fieldId}>{field.label}</Label>
              <Input
                id={fieldId}
                name={path}
                type="number"
                step={field.integer ? "1" : "any"}
                required={field.required}
                defaultValue={defaultValue}
              />
            </div>
          );
        }

        if (field.kind === "enum") {
          const defaultValue =
            defaultRow !== undefined && typeof editDefault === "string"
              ? editDefault
              : "";
          const showEmptyOption = field.nullable && !field.required;
          return (
            <div key={path} className="grid gap-1 text-sm">
              <Label htmlFor={fieldId}>{field.label}</Label>
              <select
                id={fieldId}
                name={path}
                required={field.required}
                defaultValue={defaultValue}
                className={SELECT_CLASS}
              >
                {showEmptyOption ? <option value="">—</option> : null}
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.kind === "string") {
          const defaultValue =
            defaultRow !== undefined && typeof editDefault === "string"
              ? editDefault
              : undefined;

          if (field.format === "textarea") {
            return (
              <div key={path} className="grid gap-1 text-sm">
                <Label htmlFor={fieldId}>{field.label}</Label>
                <textarea
                  id={fieldId}
                  name={path}
                  rows={4}
                  required={field.required}
                  defaultValue={defaultValue}
                  className={TEXTAREA_CLASS}
                />
              </div>
            );
          }

          if (field.format === "date-time") {
            return (
              <div key={path} className="grid gap-1 text-sm">
                <Label htmlFor={fieldId}>{field.label}</Label>
                <Input
                  id={fieldId}
                  name={path}
                  type="datetime-local"
                  required={field.required}
                  defaultValue={defaultValue}
                />
              </div>
            );
          }

          return (
            <div key={path} className="grid gap-1 text-sm">
              <Label htmlFor={fieldId}>{field.label}</Label>
              <Input
                id={fieldId}
                name={path}
                type="text"
                required={field.required}
                defaultValue={defaultValue}
              />
            </div>
          );
        }

        return null;
      })}
    </>
  );
};
