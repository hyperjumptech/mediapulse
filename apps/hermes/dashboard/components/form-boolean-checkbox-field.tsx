"use client";

import type { ReactNode } from "react";

import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/ui/lib/utils";

const defaultCheckboxClassName = "size-4 rounded border border-input";

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
  labelClassName,
  checkboxClassName,
}: FormBooleanCheckboxFieldProps) => {
  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value="false" readOnly />
      <input
        id={id}
        name={name}
        type="checkbox"
        value={checkedSubmitValue}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className={cn(defaultCheckboxClassName, checkboxClassName)}
      />
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
    </div>
  );
};
