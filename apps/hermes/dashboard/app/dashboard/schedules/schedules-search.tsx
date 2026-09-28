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
import type { ScheduleSortDir, ScheduleSortField } from "@/lib/schedules";

const BASE_PATH = "/dashboard/schedules";

type SchedulesSearchProps = {
  initialQuery?: string;
  pageSize: number;
  sortBy: ScheduleSortField;
  sortDir: ScheduleSortDir;
};

export const SchedulesSearch = ({
  initialQuery = "",
  pageSize,
  sortBy,
  sortDir,
}: SchedulesSearchProps) => {
  const hasActiveSearch = initialQuery.trim().length > 0;
  const clearHref = buildListHref(BASE_PATH, { pageSize, sortBy, sortDir });

  return (
    <Form
      action={BASE_PATH}
      role="search"
      aria-label="Search schedules by name or description"
      className="w-full sm:max-w-sm"
    >
      <input type="hidden" name="size" value={pageSize} />
      <input type="hidden" name="sort" value={sortBy} />
      <input type="hidden" name="dir" value={sortDir} />
      <Label htmlFor="schedules-search" className="sr-only">
        Search by name or description
      </Label>
      <InputGroup className="bg-background">
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          id="schedules-search"
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder="Filter schedules…"
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
