import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";

import { useTabSearchState } from "../hooks/use-tab-search-state";
import type { LoadPageArgs, VariableOption } from "../types";
import { PickerTabList } from "./picker-tab-list";

export type VariablesPickerSectionProps = {
  loadPage: (
    args: LoadPageArgs,
  ) => Promise<{ items: VariableOption[]; total: number }>;
  pageSize: number;
  enabled: boolean;
  onPickKey: (key: string) => void;
};

/**
 * Search field + paginated list of variable keys for insertion as {{key}}.
 *
 * @param props - Loader, page size, enabled, pick handler.
 * @returns Variables tab content.
 */
export const VariablesPickerSection = ({
  loadPage,
  pageSize,
  enabled,
  onPickKey,
}: VariablesPickerSectionProps) => {
  const { searchInput, setSearchInput, debouncedSearch } = useTabSearchState();

  return (
    <div className="grid gap-2">
      <Input
        placeholder="Search variables…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        aria-label="Search variables"
      />
      <PickerTabList
        key={debouncedSearch}
        search={debouncedSearch}
        loadPage={loadPage}
        pageSize={pageSize}
        enabled={enabled}
        getItemKey={(v) => v.key}
        renderRow={(v) => {
          const desc =
            v.description != null && String(v.description).trim() !== ""
              ? String(v.description).trim()
              : null;
          return (
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between gap-3 py-2 font-mono text-sm"
              onClick={() => onPickKey(v.key)}
            >
              <span className="min-w-0 shrink-0 text-left">{v.key}</span>
              {desc ? (
                <span
                  className="text-muted-foreground max-w-[55%] min-w-0 shrink truncate text-right text-xs font-sans"
                  title={desc}
                >
                  {desc}
                </span>
              ) : null}
            </Button>
          );
        }}
        emptyLabel="No variables match your search."
        aria-label="Variables list"
      />
    </div>
  );
};
