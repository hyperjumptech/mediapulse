"use client";

import { useId } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";

import {
  getDomainTableFieldEditDefault,
  parseJsonObjectRow,
  type DomainTableFormField,
} from "@/lib/domain-table-form-schema";

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
              <CardContent className="flex flex-col gap-6 px-4 py-4">
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
            <Field key={path} orientation="horizontal">
              <Checkbox
                id={fieldId}
                name={path}
                value="true"
                defaultChecked={checked}
              />
              <FieldLabel
                htmlFor={fieldId}
                className="cursor-pointer font-normal"
              >
                {field.label}
              </FieldLabel>
            </Field>
          );
        }

        if (field.kind === "number") {
          const defaultValue =
            defaultRow !== undefined && typeof editDefault === "string"
              ? editDefault
              : undefined;
          return (
            <Field key={path}>
              <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
              <Input
                id={fieldId}
                name={path}
                type="number"
                step={field.integer ? "1" : "any"}
                required={field.required}
                defaultValue={defaultValue}
              />
            </Field>
          );
        }

        if (field.kind === "enum") {
          const defaultValue =
            defaultRow !== undefined && typeof editDefault === "string"
              ? editDefault
              : "";
          const showEmptyOption = field.nullable && !field.required;
          return (
            <Field key={path}>
              <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
              <NativeSelect
                id={fieldId}
                name={path}
                required={field.required}
                defaultValue={defaultValue}
              >
                {showEmptyOption ? (
                  <NativeSelectOption value="">—</NativeSelectOption>
                ) : null}
                {field.options.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {option}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          );
        }

        if (field.kind === "string") {
          const defaultValue =
            defaultRow !== undefined && typeof editDefault === "string"
              ? editDefault
              : undefined;

          if (field.format === "textarea") {
            return (
              <Field key={path}>
                <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                <Textarea
                  id={fieldId}
                  name={path}
                  rows={4}
                  required={field.required}
                  defaultValue={defaultValue}
                  className="min-h-24"
                />
              </Field>
            );
          }

          if (field.format === "date-time") {
            return (
              <Field key={path}>
                <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
                <Input
                  id={fieldId}
                  name={path}
                  type="datetime-local"
                  required={field.required}
                  defaultValue={defaultValue}
                />
              </Field>
            );
          }

          return (
            <Field key={path}>
              <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
              <Input
                id={fieldId}
                name={path}
                type="text"
                required={field.required}
                defaultValue={defaultValue}
              />
            </Field>
          );
        }

        return null;
      })}
    </>
  );
};
