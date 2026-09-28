"use client";

import { ChevronDown, Columns3 } from "lucide-react";
import type { ReactTable, RowData } from "@tanstack/react-table";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import type { DataTableFeatures } from "@/lib/data-table/features";

export const DataTableViewOptions = <Row extends RowData>({
  table,
}: {
  table: ReactTable<DataTableFeatures, Row>;
}) => {
  const hideableColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide());
  if (hideableColumns.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Customize columns">
          <Columns3 aria-hidden />
          <span className="hidden lg:inline">Customize Columns</span>
          <span className="lg:hidden">Columns</span>
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {hideableColumns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => column.toggleVisibility(checked)}
            onSelect={(event) => event.preventDefault()}
          >
            {column.columnDef.meta?.label ?? column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
