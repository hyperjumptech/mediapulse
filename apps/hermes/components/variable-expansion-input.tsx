"use client";

import * as React from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export type VariableOption = { key: string };

export type ExpansionOption = {
  id: string;
  name: string;
  expansionString: string;
};

export type VariableExpansionInputProps = {
  /** Current string value. */
  value: string;
  /** Called when the value changes (e.g. user types or inserts from picker). */
  onChange: (value: string) => void;
  /** Input id for label association. */
  id?: string;
  /** Label text shown above the input. */
  label?: string;
  /** Optional description below the input. */
  description?: string;
  /** Whether the input and picker are disabled. */
  disabled?: boolean;
  /** Variable keys available for insertion ({{key}}). */
  variables: VariableOption[];
  /** Data source expansion templates (name + expansionString for insertion). */
  expansions: ExpansionOption[];
};

/**
 * Returns the next value after inserting text at the given range.
 * Caller should set the input value and then restore selection in a requestAnimationFrame or after onChange.
 *
 * @param current - Current string value.
 * @param start - Selection start index.
 * @param end - Selection end index.
 * @param inserted - Text to insert.
 * @returns New string with inserted text at the range.
 */
export const insertAtRange = (
  current: string,
  start: number,
  end: number,
  inserted: string,
): string => {
  return current.slice(0, start) + inserted + current.slice(end);
};

/**
 * Hook that holds input ref and insert callback. Inserts text at current selection/cursor and calls onChange.
 */
const useVariableExpansionInputState = (
  value: string,
  onChange: (value: string) => void,
) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const insert = React.useCallback(
    (text: string) => {
      const input = inputRef.current;
      const start = input?.selectionStart ?? value.length;
      const end = input?.selectionEnd ?? value.length;
      const next = insertAtRange(value, start, end, text);
      onChange(next);
      requestAnimationFrame(() => {
        input?.focus();
        const pos = start + text.length;
        input?.setSelectionRange(pos, pos);
      });
    },
    [value, onChange],
  );

  return { inputRef, insert };
};

/**
 * Input that supports free text plus a picker to insert variable placeholders ({{key}})
 * or data source expansion template strings at the cursor.
 */
export const VariableExpansionInput = ({
  value,
  onChange,
  id,
  label,
  description,
  disabled = false,
  variables,
  expansions,
}: VariableExpansionInputProps) => {
  const { inputRef, insert } = useVariableExpansionInputState(value, onChange);
  const hasVariables = variables.length > 0;
  const hasExpansions = expansions.length > 0;
  const showPicker = hasVariables || hasExpansions;

  return (
    <div className="grid gap-1.5">
      {label != null && label !== "" ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      ) : null}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1"
          aria-describedby={description ? `${id ?? "input"}-desc` : undefined}
        />
        {showPicker ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                aria-label="Insert variable or expansion"
              >
                Insert…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-[min(16rem,50vh)] overflow-y-auto"
            >
              {hasVariables ? (
                <>
                  <DropdownMenuItem
                    disabled
                    className="font-medium text-muted-foreground"
                  >
                    Variable
                  </DropdownMenuItem>
                  {variables.map((v) => (
                    <DropdownMenuItem
                      key={v.key}
                      onSelect={(e) => {
                        e.preventDefault();
                        insert(`{{${v.key}}}`);
                      }}
                    >
                      {v.key}
                    </DropdownMenuItem>
                  ))}
                  {hasExpansions ? <DropdownMenuSeparator /> : null}
                </>
              ) : null}
              {hasExpansions ? (
                <>
                  <DropdownMenuItem
                    disabled
                    className="font-medium text-muted-foreground"
                  >
                    Data source expansion
                  </DropdownMenuItem>
                  {expansions.map((e) => (
                    <DropdownMenuItem
                      key={e.id}
                      onSelect={(ev) => {
                        ev.preventDefault();
                        insert(e.expansionString);
                      }}
                      title={e.expansionString}
                    >
                      <span className="truncate">{e.name}</span>
                    </DropdownMenuItem>
                  ))}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {description ? (
        <p
          id={id ? `${id}-desc` : "input-desc"}
          className="text-muted-foreground text-xs"
        >
          {description}
        </p>
      ) : null}
    </div>
  );
};
