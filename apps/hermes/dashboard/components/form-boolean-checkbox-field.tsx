"use client";

import type { ReactNode } from "react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@workspace/ui/components/field";
import { cn } from "@workspace/ui/lib/utils";

export const nativeCheckboxClassName = cn(
  "peer size-4 shrink-0 cursor-pointer rounded-[4px] border border-input accent-primary shadow-xs outline-none",
  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export type FormBooleanCheckboxFieldProps = {
  /** Shared `name` on the hidden input and checkbox (e.g. `body.isActive`). */
  name: string;
  /** Checkbox `id`; used with the label’s `htmlFor`. */
  id: string;
  /** Initial checked state for the checkbox. */
  defaultChecked: boolean;
  /**
   * Submitted when the box is checked. Use `"on"` for Zod unions that include
   * `z.literal("on")` (e.g. HTTP triggers, schedules). Use `"true"` for
   * `zFormBoolean` and unions with `"true"` / `"false"` (pipelines, agents, variables).
   */
  checkedSubmitValue?: "on" | "true";
  /** Disables the checkbox (hidden field stays enabled so `false` still posts). */
  disabled?: boolean;
  /** Visible label text or element. */
  label: ReactNode;
  description?: ReactNode;
  /** Optional classes on the label (e.g. cursor, font size). */
  labelClassName?: string;
  /** Merged with the default checkbox sizing / border classes. */
  checkboxClassName?: string;
};

/**
 * Renders a boolean form field as a hidden `false` plus a checkbox, so unchecked
 * states still post `false` (native checkboxes omit the name when unchecked).
 * Duplicate `name` values rely on the form parser keeping the last value when checked.
 */
export const FormBooleanCheckboxField = ({
  name,
  id,
  defaultChecked,
  checkedSubmitValue = "true",
  disabled = false,
  label,
  description,
  labelClassName,
  checkboxClassName,
}: FormBooleanCheckboxFieldProps) => {
  const labelElement = (
    <FieldLabel
      htmlFor={id}
      className={cn("cursor-pointer font-normal", labelClassName)}
    >
      {label}
    </FieldLabel>
  );
  const checkboxAlignmentClassName = description ? "mt-0.5" : undefined;

  return (
    <Field orientation="horizontal" data-disabled={disabled || undefined}>
      <input type="hidden" name={name} value="false" readOnly />
      <input
        id={id}
        name={name}
        type="checkbox"
        value={checkedSubmitValue}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className={cn(
          nativeCheckboxClassName,
          checkboxAlignmentClassName,
          checkboxClassName,
        )}
      />
      {description ? (
        <FieldContent>
          {labelElement}
          <FieldDescription>{description}</FieldDescription>
        </FieldContent>
      ) : (
        labelElement
      )}
    </Field>
  );
};
