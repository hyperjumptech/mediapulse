import Link from "next/link";
import { Link2, SearchX } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";

import { RelativeTime } from "@/components/relative-time";
import type { ProcessedUrlItem } from "@/lib/domain-dashboard";

export type ProcessedUrlFilterOption = {
  label: string;
  href: string;
  isActive: boolean;
};

export type ProcessedUrlFilterGroup = {
  key: string;
  label: string;
  options: ProcessedUrlFilterOption[];
};

const STATUS_BADGE: Record<string, "success" | "destructive" | "outline"> = {
  collected: "success",
  failed: "destructive",
  dropped: "outline",
};

const MAX_URL_LABEL_LENGTH = 80;

const truncateUrl = (url: string): string =>
  url.length > MAX_URL_LABEL_LENGTH
    ? `${url.slice(0, MAX_URL_LABEL_LENGTH)}…`
    : url;

const ProcessedUrlFilterGroupControl = ({
  group,
}: {
  group: ProcessedUrlFilterGroup;
}) => {
  const labelId = `processed-urls-filter-${group.key}`;

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-wrap items-center gap-2"
    >
      <span id={labelId} className="text-xs font-medium text-muted-foreground">
        {group.label}
      </span>
      <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-muted p-0.5">
        {group.options.map((option) => {
          const optionClassName = cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
            option.isActive
              ? "bg-background text-foreground shadow-sm dark:bg-input/40"
              : "text-muted-foreground hover:text-foreground",
          );

          return (
            <Link
              key={option.label}
              href={option.href}
              aria-current={option.isActive ? "true" : undefined}
              className={optionClassName}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export const ProcessedUrlsFilters = ({
  groups,
}: {
  groups: ProcessedUrlFilterGroup[];
}) => {
  return (
    <nav
      aria-label="Filter processed URLs"
      className="flex flex-wrap items-center gap-x-6 gap-y-3"
    >
      {groups.map((group) => (
        <ProcessedUrlFilterGroupControl key={group.key} group={group} />
      ))}
    </nav>
  );
};

export const ProcessedUrlsEmptyState = ({
  hasActiveFilters,
  clearFiltersHref,
}: {
  hasActiveFilters: boolean;
  clearFiltersHref: string;
}) => {
  if (hasActiveFilters) {
    return (
      <Empty className="gap-4 py-12 md:py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden className="size-5 text-muted-foreground" />
          </EmptyMedia>
          <EmptyTitle className="text-base">
            No processed URLs match these filters
          </EmptyTitle>
          <EmptyDescription>
            Try a different agent, status or gate filter.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={clearFiltersHref}>Clear filters</Link>
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Empty className="gap-4 py-12 md:py-16">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Link2 aria-hidden className="size-5 text-muted-foreground" />
        </EmptyMedia>
        <EmptyTitle className="text-base">No processed URLs</EmptyTitle>
        <EmptyDescription>
          No processed URL outcomes for this execution. Outcomes are recorded
          from agent runs triggered after this feature was deployed.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

const ProcessedUrlRow = ({ item }: { item: ProcessedUrlItem }) => {
  const statusVariant = STATUS_BADGE[item.status] ?? "outline";
  const reasonText = item.reasonDetail ?? item.reason ?? "—";
  const urlLabel = truncateUrl(item.url);

  return (
    <TableRow>
      <TableCell className="pl-4 font-mono text-xs">
        {item.tickerSymbol}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {item.agent}
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant} className="capitalize">
          {item.status}
        </Badge>
      </TableCell>
      <TableCell className="max-w-xs text-xs whitespace-normal text-muted-foreground">
        {reasonText}
      </TableCell>
      <TableCell className="max-w-sm text-xs break-all whitespace-normal">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-4 hover:underline"
        >
          {urlLabel}
        </a>
      </TableCell>
      <TableCell className="max-w-xs text-xs break-all whitespace-normal text-muted-foreground">
        {item.source ?? "—"}
      </TableCell>
      <TableCell className="pr-4 text-xs text-muted-foreground">
        <RelativeTime value={item.createdAt} />
      </TableCell>
    </TableRow>
  );
};

export const ProcessedUrlsTable = ({
  items,
}: {
  items: ProcessedUrlItem[];
}) => {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Ticker</TableHead>
          <TableHead>Agent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>URL</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="pr-4">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <ProcessedUrlRow key={item.id} item={item} />
        ))}
      </TableBody>
    </Table>
  );
};
