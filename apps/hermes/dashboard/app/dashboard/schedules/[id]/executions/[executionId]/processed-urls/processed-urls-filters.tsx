import Link from "next/link";

import { cn } from "@workspace/ui/lib/utils";

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
