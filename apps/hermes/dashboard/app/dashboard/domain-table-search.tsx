import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

type DomainTableSearchProps = {
  /** Base path for GET search (e.g. `/dashboard/mediapulse/tickers`). */
  basePath: string;
  /** Current search query for the input default value. */
  initialQuery?: string;
  /** Page size to preserve when searching. */
  pageSize: number;
  /** Sort field to preserve when searching. */
  sortBy?: string;
  /** Sort direction to preserve when searching. */
  sortDir: "asc" | "desc";
  /** Accessible name for the search region (e.g. "Search tickers"). */
  ariaLabel: string;
  /** Input placeholder text. */
  placeholder?: string;
};

/**
 * Search form for domain integration table pages. Submits via GET to preserve URL state.
 */
export const DomainTableSearch = ({
  basePath,
  initialQuery = "",
  pageSize,
  sortBy,
  sortDir,
  ariaLabel,
  placeholder = "Search…",
}: DomainTableSearchProps) => {
  const hasActiveSearch = initialQuery.trim().length > 0;
  const clearParams = new URLSearchParams();
  clearParams.set("size", String(pageSize));
  clearParams.set("dir", sortDir);
  if (sortBy) clearParams.set("sort", sortBy);
  const clearHref = `${basePath}?${clearParams.toString()}`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      <form
        action={basePath}
        method="get"
        className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:items-center"
        role="search"
        aria-label={ariaLabel}
      >
        <input type="hidden" name="size" value={pageSize} />
        <input type="hidden" name="dir" value={sortDir} />
        {sortBy ? <input type="hidden" name="sort" value={sortBy} /> : null}
        <div className="flex-1 space-y-2">
          <Label htmlFor="domain-table-search" className="sr-only">
            {ariaLabel}
          </Label>
          <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 has-focus-visible:outline-none has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-offset-2">
            <Search
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="domain-table-search"
              type="search"
              name="q"
              defaultValue={initialQuery}
              placeholder={placeholder}
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
