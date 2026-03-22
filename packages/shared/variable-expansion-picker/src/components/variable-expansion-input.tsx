"use client";

import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
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

/**
 * Input that supports free text plus a modal picker to insert variable placeholders ({{key}})
 * or data source expansion template strings at the cursor.
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

  const handleInsertVariable = React.useCallback(
    (key: string) => {
      insert(`{{${key}}}`);
      setOpen(false);
    },
    [insert, setOpen],
  );

  const handleInsertExpansion = React.useCallback(
    (expansion: { expansionString: string }) => {
      insert(expansion.expansionString);
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
