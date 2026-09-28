import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import { Label } from "@workspace/ui/components/label";

import { buildListHref } from "@/lib/list-page-params";
import type { VariableSortDir, VariableSortField } from "@/lib/variables";

const BASE_PATH = "/dashboard/variables";

type VariablesSearchProps = {
  initialQuery?: string;
  pageSize: number;
  sortBy: VariableSortField;
  sortDir: VariableSortDir;
};

export const VariablesSearch = ({
  initialQuery = "",
  pageSize,
  sortBy,
  sortDir,
}: VariablesSearchProps) => {
  const hasActiveSearch = initialQuery.trim().length > 0;
  const clearHref = buildListHref(BASE_PATH, { pageSize, sortBy, sortDir });

  return (
    <Form
      action={BASE_PATH}
      role="search"
      aria-label="Search variables by key"
      className="w-full sm:max-w-sm"
    >
      <input type="hidden" name="size" value={pageSize} />
      <input type="hidden" name="sort" value={sortBy} />
      <input type="hidden" name="dir" value={sortDir} />
      <Label htmlFor="variables-search" className="sr-only">
        Search by key
      </Label>
      <InputGroup className="bg-background">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id="variables-search"
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder="Search by key…"
          autoComplete="off"
          enterKeyHint="search"
          className="[&::-webkit-search-cancel-button]:appearance-none"
        />
        {hasActiveSearch ? (
          <InputGroupAddon align="inline-end">
            <Link
              href={clearHref}
              aria-label="Clear search"
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </Link>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </Form>
  );
};
