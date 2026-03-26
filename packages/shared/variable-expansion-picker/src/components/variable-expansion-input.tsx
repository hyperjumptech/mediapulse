"use client";

import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Badge } from "@workspace/ui/components/badge";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { useVariableExpansionInputCore } from "../hooks/use-variable-expansion-input-core";
import { useVariableExpansionPickerModalShell } from "../hooks/use-variable-expansion-picker-modal-shell";
import type {
  ExpansionOption,
  LoadExpansionsPageResult,
  LoadPageArgs,
  LoadVariablesPageResult,
} from "../types";
import { ExpansionsPickerSection } from "./expansions-picker-section";
import { VariablesPickerSection } from "./variables-picker-section";

/** Default page size for variables and expansions lists inside the modal. */
export const DEFAULT_PICKER_PAGE_SIZE = 20;

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
  /** Loads a page of variable keys for the Variables tab. */
  loadVariablesPage: (args: LoadPageArgs) => Promise<LoadVariablesPageResult>;
  /** Loads a page of expansions for the Expansions tab. */
  loadExpansionsPage: (args: LoadPageArgs) => Promise<LoadExpansionsPageResult>;
  /** Items per page in the modal lists (default {@link DEFAULT_PICKER_PAGE_SIZE}). */
  pageSize?: number;
};

const DSE_REFERENCE_TOKEN_REGEX = /\{\{dse:([a-zA-Z0-9_-]+)\}\}/g;

type DisplaySegment =
  | { kind: "text"; value: string }
  | { kind: "dse-reference"; id: string; raw: string };

/**
 * Builds the persisted token format for a data-source expansion template id.
 *
 * @param id - DataSourceExpansionTemplate row id.
 * @returns Token in `{{dse:<id>}}` format.
 */
const buildDataSourceExpansionReference = (id: string): string => {
  return `{{dse:${id}}}`;
};

/**
 * Splits an input value into plain text and data-source reference tokens so the
 * UI can render references as inline badges while preserving editable free text.
 *
 * @param value - Controlled input value.
 * @returns Ordered display segments.
 */
const tokenizeDisplaySegments = (value: string): DisplaySegment[] => {
  const segments: DisplaySegment[] = [];
  let cursor = 0;
  const matches = value.matchAll(DSE_REFERENCE_TOKEN_REGEX);
  for (const match of matches) {
    const raw = match[0];
    const id = match[1];
    const start = match.index;
    if (start == null || raw == null || id == null) {
      continue;
    }
    if (start > cursor) {
      segments.push({ kind: "text", value: value.slice(cursor, start) });
    }
    segments.push({ kind: "dse-reference", id, raw });
    cursor = start + raw.length;
  }
  if (cursor < value.length) {
    segments.push({ kind: "text", value: value.slice(cursor) });
  }
  return segments;
};

/**
 * Input that supports free text plus a modal picker to insert variable placeholders ({{key}})
 * or data source expansion template references (`{{dse:<id>}}`) at the cursor.
 *
 * @param props - Value, change handler, labels, loaders, optional page size.
 * @returns Labeled text field with Insert control opening the modal.
 */
export const VariableExpansionInput = ({
  value,
  onChange,
  id,
  label,
  description,
  disabled = false,
  loadVariablesPage,
  loadExpansionsPage,
  pageSize = DEFAULT_PICKER_PAGE_SIZE,
}: VariableExpansionInputProps) => {
  const { inputRef, insert } = useVariableExpansionInputCore(value, onChange);
  const { open, setOpen, activeTab, setActiveTab } =
    useVariableExpansionPickerModalShell();
  const displaySegments = React.useMemo(
    () => tokenizeDisplaySegments(value),
    [value],
  );

  const handleInsertVariable = React.useCallback(
    (key: string) => {
      insert(`{{${key}}}`);
      setOpen(false);
    },
    [insert, setOpen],
  );

  const handleInsertExpansion = React.useCallback(
    (expansion: ExpansionOption) => {
      insert(buildDataSourceExpansionReference(expansion.id));
      setOpen(false);
    },
    [insert, setOpen],
  );

  const variablesEnabled = open && activeTab === "variables";
  const expansionsEnabled = open && activeTab === "expansions";

  return (
    <div className="grid gap-1.5">
      {label != null && label !== "" ? (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      ) : null}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Input
            ref={inputRef}
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="min-w-0 flex-1 bg-transparent text-transparent caret-foreground selection:bg-primary/20"
            aria-describedby={description ? `${id ?? "input"}-desc` : undefined}
          />
          <div
            aria-hidden={true}
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-3 text-sm"
          >
            <span className="inline-block w-full truncate whitespace-pre text-foreground">
              {displaySegments.map((segment, index) =>
                segment.kind === "text" ? (
                  <span key={`text-${index}`}>{segment.value}</span>
                ) : (
                  <Badge
                    key={`dse-${segment.raw}-${index}`}
                    variant="secondary"
                    className="mx-0.5 inline-flex max-w-[16rem] -translate-y-px truncate px-1.5 py-0 text-[10px] font-medium"
                  >
                    dse:{segment.id}
                  </Badge>
                ),
              )}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label="Insert variable or expansion"
          onClick={() => setOpen(true)}
        >
          Insert…
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="flex max-h-[min(32rem,85vh)] max-w-2xl flex-col gap-4 overflow-hidden sm:max-w-2xl"
            showCloseButton={true}
          >
            <DialogHeader className="space-y-0">
              <DialogTitle>Insert variable or expansion</DialogTitle>
            </DialogHeader>
            <Tabs
              value={activeTab}
              onValueChange={(v) =>
                setActiveTab(v as "variables" | "expansions")
              }
              className="flex min-h-0 flex-1 flex-col gap-3"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="variables">Variables</TabsTrigger>
                <TabsTrigger value="expansions">Expansions</TabsTrigger>
              </TabsList>
              <TabsContent
                value="variables"
                className="min-h-0 flex-1 overflow-hidden outline-none"
              >
                <VariablesPickerSection
                  loadPage={loadVariablesPage}
                  pageSize={pageSize}
                  enabled={variablesEnabled}
                  onPickKey={handleInsertVariable}
                />
              </TabsContent>
              <TabsContent
                value="expansions"
                className="min-h-0 flex-1 overflow-hidden outline-none"
              >
                <ExpansionsPickerSection
                  loadPage={loadExpansionsPage}
                  pageSize={pageSize}
                  enabled={expansionsEnabled}
                  onPickExpansion={handleInsertExpansion}
                />
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
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
