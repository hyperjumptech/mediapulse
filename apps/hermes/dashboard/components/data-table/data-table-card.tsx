import type { ReactNode } from "react";

import { TableCell, TableRow } from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";

export const DataTableCard = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border [&_thead]:bg-muted",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const DataTableEmptyRow = ({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) => {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className="h-24 text-center text-sm text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  );
};
