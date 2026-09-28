"use client";

import Link, { useLinkStatus } from "next/link";
import { useCallback } from "react";
import { ChevronRight, MoreHorizontal, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/ui/lib/utils";

import { isDashboardPathActive } from "@/lib/dashboard-routes";

export type NavMainItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NavMainProps = {
  label: string;
  items: readonly NavMainItem[];
  pathname: string | null;
  visibleCount?: number;
};

const useCloseMobileSidebar = () => {
  const { isMobile, setOpenMobile } = useSidebar();

  return useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);
};

const NavLinkPendingIndicator = () => {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden
      className={cn(
        "ml-auto size-1.5 shrink-0 rounded-full bg-sidebar-foreground/50 transition-opacity delay-100",
        pending ? "animate-pulse opacity-100" : "opacity-0",
      )}
    />
  );
};

export const SidebarNavLink = ({
  item,
  isActive,
}: {
  item: NavMainItem;
  isActive: boolean;
}) => {
  const closeMobileSidebar = useCloseMobileSidebar();
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link
          href={item.href}
          aria-current={isActive ? "page" : undefined}
          onClick={closeMobileSidebar}
        >
          <Icon />
          <span className="truncate">{item.label}</span>
          <NavLinkPendingIndicator />
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const NavMoreItems = ({
  items,
  pathname,
}: {
  items: readonly NavMainItem[];
  pathname: string | null;
}) => {
  const hasActiveItem = items.some((item) =>
    isDashboardPathActive(pathname, item.href),
  );

  return (
    <Collapsible defaultOpen={hasActiveItem} className="group/more">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="text-sidebar-foreground/70">
            <MoreHorizontal />
            <span>More</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/more:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
      </SidebarMenuItem>
      <CollapsibleContent>
        {items.map((item) => (
          <SidebarNavLink
            key={item.href}
            item={item}
            isActive={isDashboardPathActive(pathname, item.href)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const NavMain = ({
  label,
  items,
  pathname,
  visibleCount,
}: NavMainProps) => {
  const splitIndex = visibleCount ?? items.length;
  const visibleItems = items.slice(0, splitIndex);
  const overflowItems = items.slice(splitIndex);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map((item) => (
            <SidebarNavLink
              key={item.href}
              item={item}
              isActive={isDashboardPathActive(pathname, item.href)}
            />
          ))}
          {overflowItems.length > 0 ? (
            <NavMoreItems items={overflowItems} pathname={pathname} />
          ) : null}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
