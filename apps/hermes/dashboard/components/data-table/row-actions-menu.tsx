"use client";

import type { ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

export const RowActionsMenu = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto flex size-8 text-muted-foreground data-[state=open]:bg-muted"
      >
        <EllipsisVertical aria-hidden />
        <span className="sr-only">{label}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-32">
      {children}
    </DropdownMenuContent>
  </DropdownMenu>
);
