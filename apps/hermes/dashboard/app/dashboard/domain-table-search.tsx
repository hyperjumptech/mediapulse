import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";

type DomainTableSearchProps = {
  basePath: string;
  initialQuery?: string;
  pageSize: number;
  sortBy?: string;
  sortDir: "asc" | "desc";
  preserveParams?: Record<string, string>;
  ariaLabel: string;
  placeholder?: string;
};

const buildClearSearchHref = (
  basePath: string,
  pageSize: number,
  sortDir: "asc" | "desc",
  sortBy: string | undefined,
  preserveParams: Record<string, string>,
) => {
  const clearParams = new URLSearchParams();
  clearParams.set("size", String(pageSize));
  clearParams.set("dir", sortDir);
  if (sortBy) {
    clearParams.set("sort", sortBy);
  }
  for (const [key, value] of Object.entries(preserveParams)) {
    clearParams.set(key, value);
  }

  return `${basePath}?${clearParams.toString()}`;
};

export const DomainTableSearch = ({
  basePath,
  initialQuery = "",
  pageSize,
  sortBy,
  sortDir,
  preserveParams = {},
  ariaLabel,
  placeholder = "Search…",
}: DomainTableSearchProps) => {
  const hasActiveSearch = initialQuery.trim().length > 0;
  const clearHref = buildClearSearchHref(
    basePath,
    pageSize,
    sortDir,
    sortBy,
    preserveParams,
  );

  return (
    <Form
      action={basePath}
      className="w-full sm:max-w-xs"
      role="search"
      aria-label={ariaLabel}
    >
      <input type="hidden" name="size" value={pageSize} />
      <input type="hidden" name="dir" value={sortDir} />
      {sortBy ? <input type="hidden" name="sort" value={sortBy} /> : null}
      {Object.entries(preserveParams).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <Label htmlFor="domain-table-search" className="sr-only">
        {ariaLabel}
      </Label>
      <InputGroup className="bg-background">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id="domain-table-search"
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          className="[&::-webkit-search-cancel-button]:appearance-none"
        />
        {hasActiveSearch ? (
          <InputGroupAddon align="inline-end">
            <Link
              href={clearHref}
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
              <span className="sr-only">Clear search</span>
            </Link>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </Form>
  );
};
