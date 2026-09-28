import type { ReactNode } from "react";

import { cn } from "@workspace/ui/lib/utils";

export type SummaryGridVariant = "card" | "plain";

const SUMMARY_GRID_VARIANT_CLASS: Record<SummaryGridVariant, string> = {
  card: "rounded-lg border bg-card px-4 py-4 sm:px-5 @3xl/main:grid-cols-3 @5xl/main:grid-cols-4",
  plain: "",
};

export const SummaryGrid = ({
  children,
  className,
  variant = "card",
}: {
  children: ReactNode;
  className?: string;
  variant?: SummaryGridVariant;
}) => {
  return (
    <dl
      data-slot="summary-grid"
      data-variant={variant}
      className={cn(
        "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2",
        SUMMARY_GRID_VARIANT_CLASS[variant],
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
  breakAll = false,
  className,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  breakAll?: boolean;
  className?: string;
}) => {
  return (
    <div
      data-slot="summary-item"
      className={cn(
        "flex min-w-0 flex-col gap-1",
        wide && "col-span-full",
        className,
      )}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 text-sm text-foreground",
          breakAll ? "break-all" : "break-words",
        )}
      >
        {children}
      </dd>
    </div>
  );
};
