import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

type SearchQueriesFilterProps = {
  /** Current ticker-name filter shown in the input. */
  initialTickerName?: string;
  /** Current page size to preserve when submitting filter. */
  pageSize: number;
};

/**
 * Filter form for search queries by ticker name. Submits via GET to preserve URL state.
 */
export const SearchQueriesFilter = ({
  initialTickerName = "",
  pageSize,
}: SearchQueriesFilterProps) => {
  const hasActiveFilter = initialTickerName.trim().length > 0;
  const clearHref = `/dashboard/search-queries?size=${pageSize}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <form
        action="/dashboard/search-queries"
        method="get"
        className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:items-center"
        role="search"
        aria-label="Filter search queries by ticker name"
      >
        <input type="hidden" name="size" value={pageSize} />
        <input type="hidden" name="page" value="1" />
        <div className="flex-1 space-y-2">
          <Label htmlFor="search-queries-filter" className="sr-only">
            Filter by ticker name
          </Label>
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 has-focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="search-queries-filter"
              type="search"
              name="ticker"
              defaultValue={initialTickerName}
              placeholder="Filter by ticker name..."
              className="min-h-0 flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
              autoComplete="off"
            />
          </div>
        </div>
        <Button type="submit">Filter</Button>
      </form>
      {hasActiveFilter ? (
        <div className="flex h-9 shrink-0 items-center">
          <Link
            href={clearHref}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="underline underline-offset-2 decoration-muted-foreground/40 hover:decoration-foreground">
              Clear filter
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  );
};
