import type { ReactNode } from "react";

import { cn } from "@workspace/ui/lib/utils";

export const SummaryGrid = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <dl
      data-slot="summary-grid"
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card px-4 py-4 sm:px-5 md:grid-cols-3 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </dl>
  );
};

export const SummaryItem = ({
  label,
  children,
  wide = false,
  className,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) => {
  return (
    <div
      data-slot="summary-item"
      className={cn(
        "flex min-w-0 flex-col gap-1",
        wide && "col-span-2",
        className,
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-foreground">
        {children}
      </dd>
    </div>
  );
};
