"use client";

import type { ComponentPropsWithoutRef } from "react";
import { Search } from "lucide-react";

import { Kbd } from "@workspace/ui/components/kbd";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";

import { isDashboardPathActive } from "@/lib/dashboard-routes";

import { useCommandPaletteContext } from "./command-palette-provider";
import { SidebarNavLink, type NavMainItem } from "./nav-main";

type NavSecondaryProps = {
  items: readonly NavMainItem[];
  pathname: string | null;
} & ComponentPropsWithoutRef<typeof SidebarGroup>;

export const NavSecondary = ({
  items,
  pathname,
  ...props
}: NavSecondaryProps) => {
  const { setOpen } = useCommandPaletteContext();

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              isActive={isDashboardPathActive(pathname, item.href)}
            />
          ))}
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Search" onClick={() => setOpen(true)}>
              <Search />
              <span>Search</span>
              <Kbd className="ml-auto">⌘K</Kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
