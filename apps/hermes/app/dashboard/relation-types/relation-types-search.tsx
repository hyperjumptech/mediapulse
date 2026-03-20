import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import type {
  RelationTypeSortDir,
  RelationTypeSortField,
} from "@/lib/relation-types";

type RelationTypesSearchProps = {
  initialQuery?: string;
  pageSize: number;
  sortBy: RelationTypeSortField;
  sortDir: RelationTypeSortDir;
};

/**
 * Search form for relation types by name. Submits via GET to preserve URL state.
 */
export const RelationTypesSearch = ({
  initialQuery = "",
  pageSize,
  sortBy,
  sortDir,
}: RelationTypesSearchProps) => {
  const hasActiveSearch = initialQuery.trim().length > 0;
  const clearHref = `/dashboard/relation-types?size=${pageSize}&sort=${sortBy}&dir=${sortDir}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <form
        action="/dashboard/relation-types"
        method="get"
        className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:items-center"
        role="search"
        aria-label="Search relation types by name"
      >
        <input type="hidden" name="size" value={pageSize} />
        <input type="hidden" name="sort" value={sortBy} />
        <input type="hidden" name="dir" value={sortDir} />
        <div className="flex-1 space-y-2">
          <Label htmlFor="relation-types-search" className="sr-only">
            Search by name
          </Label>
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 has-focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="relation-types-search"
              type="search"
              name="q"
              defaultValue={initialQuery}
              placeholder="Search by name..."
              className="min-h-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              autoComplete="off"
            />
          </div>
        </div>
        <Button type="submit">Search</Button>
      </form>
      {hasActiveSearch && (
        <div className="flex h-9 shrink-0 items-center">
          <Link
            href={clearHref}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground">
              Clear search
            </span>
          </Link>
        </div>
      )}
    </div>
  );
};
