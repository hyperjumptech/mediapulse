"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

import { usePageSizeNavigation } from "@/hooks/use-page-size-navigation";
import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/list-page-params";

import { PaginationStepButton } from "./pagination-step-button";

export type ListPaginationProps = {
  basePath: string;
  page: number;
  pageSize: number;
  total: number;
  ariaLabel: string;
  searchQuery?: string;
  sortBy?: string;
  sortDir?: string;
  extraParams?: Record<string, string>;
};

const PAGE_SIZE_OPTIONS = [DEFAULT_LIST_PAGE_SIZE, 30, 50, 100];

const SMALLEST_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

const countFormatter = new Intl.NumberFormat("en-US");

const buildQueryString = (
  page: number,
  pageSize: number,
  options: {
    searchQuery?: string;
    sortBy?: string;
    sortDir?: string;
    extraParams?: Record<string, string>;
  },
): string => {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("size", String(pageSize));
  if (options.searchQuery) {
    params.set("q", options.searchQuery);
  }
  if (options.sortBy) {
    params.set("sort", options.sortBy);
  }
  if (options.sortDir) {
    params.set("dir", options.sortDir);
  }
  for (const [key, value] of Object.entries(options.extraParams ?? {})) {
    params.set(key, value);
  }

  return params.toString();
};

export const describeVisibleRange = (
  page: number,
  pageSize: number,
  total: number,
): string => {
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const formattedTotal = countFormatter.format(total);
  if (firstItem > total) {
    return `${formattedTotal} total`;
  }
  const formattedFirstItem = countFormatter.format(firstItem);
  const formattedLastItem = countFormatter.format(lastItem);

  return `Showing ${formattedFirstItem}–${formattedLastItem} of ${formattedTotal}`;
};

const pageSizeOptionsFor = (pageSize: number): number[] =>
  PAGE_SIZE_OPTIONS.includes(pageSize)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, pageSize].sort((left, right) => left - right);

export const ListPagination = ({
  basePath,
  page,
  pageSize,
  total,
  ariaLabel,
  searchQuery,
  sortBy,
  sortDir,
  extraParams,
}: ListPaginationProps) => {
  const queryOptions = { searchQuery, sortBy, sortDir, extraParams };
  const hrefFor = (targetPage: number, targetPageSize = pageSize) =>
    `${basePath}?${buildQueryString(targetPage, targetPageSize, queryOptions)}`;
  const changePageSize = usePageSizeNavigation((nextPageSize) =>
    hrefFor(1, nextPageSize),
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;
  if (totalPages <= 1 && total <= SMALLEST_PAGE_SIZE) {
    return null;
  }
  const pageSizeSelectId = `${basePath.replaceAll("/", "-")}-rows-per-page`;

  return (
    <nav
      className="flex items-center justify-between px-4"
      aria-label={ariaLabel}
    >
      <p className="hidden flex-1 text-sm text-muted-foreground tabular-nums lg:flex">
        {describeVisibleRange(page, pageSize, total)}
      </p>
      <div className="flex w-full items-center gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor={pageSizeSelectId} className="text-sm font-medium">
            Rows per page
          </Label>
          <Select value={String(pageSize)} onValueChange={changePageSize}>
            <SelectTrigger size="sm" className="w-20" id={pageSizeSelectId}>
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptionsFor(pageSize).map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium tabular-nums">
          Page {page} of {totalPages}
        </div>
        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <PaginationStepButton
            href={hasPrevious ? hrefFor(1) : undefined}
            label="Go to first page"
            icon={ChevronsLeft}
            className="hidden lg:flex"
          />
          <PaginationStepButton
            href={hasPrevious ? hrefFor(page - 1) : undefined}
            label="Go to previous page"
            rel="prev"
            icon={ChevronLeft}
          />
          <PaginationStepButton
            href={hasNext ? hrefFor(page + 1) : undefined}
            label="Go to next page"
            rel="next"
            icon={ChevronRight}
          />
          <PaginationStepButton
            href={hasNext ? hrefFor(totalPages) : undefined}
            label="Go to last page"
            icon={ChevronsRight}
            className="hidden lg:flex"
          />
        </div>
      </div>
    </nav>
  );
};
