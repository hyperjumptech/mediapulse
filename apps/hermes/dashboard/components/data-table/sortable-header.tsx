import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import Link from "next/link";

import { Button } from "@workspace/ui/components/button";

import type { SortDirection } from "@/lib/list-page-params";

const ariaSortFor = (isActive: boolean, direction: SortDirection) => {
  if (!isActive) {
    return undefined;
  }

  return direction === "asc" ? "ascending" : "descending";
};

export const SortableHeader = ({
  label,
  href,
  isActive,
  direction,
}: {
  label: string;
  href: string;
  isActive: boolean;
  direction: SortDirection;
}) => {
  const activeIcon = direction === "asc" ? ArrowUp : ArrowDown;
  const Icon = isActive ? activeIcon : ChevronsUpDown;

  return (
    <Button variant="ghost" size="sm" className="-ml-2.5 h-8" asChild>
      <Link
        href={href}
        scroll={false}
        aria-sort={ariaSortFor(isActive, direction)}
      >
        {label}
        <Icon aria-hidden />
      </Link>
    </Button>
  );
};
