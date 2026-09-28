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

import {
  buildSortHref,
  type ListUrlState,
} from "@/lib/data-table/list-url-state";

type DataTableColumnHeaderProps = {
  label: string;
  sortKey: string;
  urlState: ListUrlState;
  onHide?: () => void;
};

const sortIconFor = (isActive: boolean, urlState: ListUrlState) => {
  if (!isActive) {
    return ChevronsUpDown;
  }

  return urlState.sortDir === "asc" ? ArrowUp : ArrowDown;
};

export const DataTableColumnHeader = ({
  label,
  sortKey,
  urlState,
  onHide,
}: DataTableColumnHeaderProps) => {
  const isActive = urlState.sortBy === sortKey;
  const SortIcon = sortIconFor(isActive, urlState);

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
        <DropdownMenuItem asChild>
          <Link href={buildSortHref(urlState, sortKey, "asc")} scroll={false}>
            <ArrowUp aria-hidden />
            Asc
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={buildSortHref(urlState, sortKey, "desc")} scroll={false}>
            <ArrowDown aria-hidden />
            Desc
          </Link>
        </DropdownMenuItem>
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
