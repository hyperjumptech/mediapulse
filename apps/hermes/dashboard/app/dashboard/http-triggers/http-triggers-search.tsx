"use client";

import { useMemo, useState } from "react";
const useHttpTriggersSearchState = (initialQuery: string) => {
  const [query, setQuery] = useState(initialQuery);
  return { query, setQuery };
};

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import type {
  HttpTriggerSortDir,
  HttpTriggerSortField,
} from "@/lib/http-triggers";

type HttpTriggersSearchProps = {
  initialQuery: string;
  pageSize: number;
  sortBy: HttpTriggerSortField;
  sortDir: HttpTriggerSortDir;
};

/**
 * Search form for HTTP triggers list.
 */
export const HttpTriggersSearch = ({
  initialQuery,
  pageSize,
  sortBy,
  sortDir,
}: HttpTriggersSearchProps) => {
  const { query, setQuery } = useHttpTriggersSearchState(initialQuery);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const base = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = new URLSearchParams(base.toString());
    next.set("page", "1");
    next.set("size", String(pageSize));
    next.set("sort", sortBy);
    next.set("dir", sortDir);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md items-center gap-2"
    >
      <div className="relative w-full">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search HTTP triggers..."
          className="pl-9"
          aria-label="Search HTTP triggers"
        />
      </div>
      <Button type="submit" variant="outline">
        Search
      </Button>
    </form>
  );
};
