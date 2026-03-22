import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";

import { useTabSearchState } from "../hooks/use-tab-search-state";
import type { ExpansionOption, LoadPageArgs } from "../types";
import { PickerTabList } from "./picker-tab-list";

export type ExpansionsPickerSectionProps = {
  loadPage: (
    args: LoadPageArgs,
  ) => Promise<{ items: ExpansionOption[]; total: number }>;
  pageSize: number;
  enabled: boolean;
  onPickExpansion: (expansion: ExpansionOption) => void;
};

/**
 * Search field + paginated list of data source expansions.
 *
 * @param props - Loader, page size, enabled, pick handler.
 * @returns Expansions tab content.
 */
export const ExpansionsPickerSection = ({
  loadPage,
  pageSize,
  enabled,
  onPickExpansion,
}: ExpansionsPickerSectionProps) => {
  const { searchInput, setSearchInput, debouncedSearch } = useTabSearchState();

  return (
    <div className="grid gap-2">
      <Input
        placeholder="Search expansions…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        aria-label="Search expansions"
      />
      <PickerTabList
        key={debouncedSearch}
        search={debouncedSearch}
        loadPage={loadPage}
        pageSize={pageSize}
        enabled={enabled}
        getItemKey={(e) => e.id}
        renderRow={(exp) => {
          const desc =
            exp.description != null && String(exp.description).trim() !== ""
              ? String(exp.description).trim()
              : null;
          return (
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between gap-3 py-2 text-sm"
              title={exp.expansionString}
              onClick={() => onPickExpansion(exp)}
            >
              <span className="min-w-0 shrink truncate text-left font-medium">
                {exp.name}
              </span>
              {desc ? (
                <span
                  className="text-muted-foreground max-w-[55%] min-w-0 shrink truncate text-right text-xs"
                  title={desc}
                >
                  {desc}
                </span>
              ) : null}
            </Button>
          );
        }}
        emptyLabel="No expansions match your search."
        aria-label="Expansions list"
      />
    </div>
  );
};
