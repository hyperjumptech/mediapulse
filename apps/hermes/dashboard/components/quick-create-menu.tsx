"use client";

import Link from "next/link";
import { CirclePlus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";

import { dashboardQuickCreateItems } from "@/lib/dashboard-routes";

export const QuickCreateMenu = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="sm" aria-label="Quick create">
        <CirclePlus />
        <span className="hidden sm:inline">Quick Create</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuLabel>Create</DropdownMenuLabel>
      {dashboardQuickCreateItems.map((item) => {
        const Icon = item.icon;

        return (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <Icon />
              {item.label}
            </Link>
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);
