import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link from "next/link";

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
  const ascendingIcon = direction === "asc" ? ArrowUp : ArrowDown;
  const Icon = isActive ? ascendingIcon : ArrowUpDown;

  return (
    <Link
      href={href}
      scroll={false}
      aria-sort={ariaSortFor(isActive, direction)}
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent hover:text-foreground"
    >
      {label}
      <Icon
        aria-hidden
        className={isActive ? "size-3.5" : "size-3.5 opacity-40"}
      />
    </Link>
  );
};
