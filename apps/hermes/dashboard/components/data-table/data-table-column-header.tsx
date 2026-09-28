"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export type ColumnSortDirection = "asc" | "desc";

export type ColumnSortTargets =
  | { kind: "link"; ascHref: string; descHref: string }
  | { kind: "client"; onSort: (direction: ColumnSortDirection) => void };

type DataTableColumnHeaderProps = {
  label: string;
  activeDirection: ColumnSortDirection | null;
  targets: ColumnSortTargets;
  onHide?: () => void;
};

const sortIconFor = (activeDirection: ColumnSortDirection | null) => {
  if (!activeDirection) {
    return ChevronsUpDown;
  }

  return activeDirection === "asc" ? ArrowUp : ArrowDown;
};

const SortItem = ({
  direction,
  targets,
}: {
  direction: ColumnSortDirection;
  targets: ColumnSortTargets;
}) => {
  const Icon = direction === "asc" ? ArrowUp : ArrowDown;
  const label = direction === "asc" ? "Asc" : "Desc";
  if (targets.kind === "client") {
    return (
      <DropdownMenuItem onSelect={() => targets.onSort(direction)}>
        <Icon aria-hidden />
        {label}
      </DropdownMenuItem>
    );
  }
  const href = direction === "asc" ? targets.ascHref : targets.descHref;

  return (
    <DropdownMenuItem asChild>
      <Link href={href} scroll={false}>
        <Icon aria-hidden />
        {label}
      </Link>
    </DropdownMenuItem>
  );
};

export const DataTableColumnHeader = ({
  label,
  activeDirection,
  targets,
  onHide,
}: DataTableColumnHeaderProps) => {
  const SortIcon = sortIconFor(activeDirection);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2.5 h-8 data-[state=open]:bg-accent"
        >
          {label}
          <SortIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <SortItem direction="asc" targets={targets} />
        <SortItem direction="desc" targets={targets} />
        {onHide ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onHide}>
              <EyeOff aria-hidden />
              Hide
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
