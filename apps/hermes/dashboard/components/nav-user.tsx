"use client";

import { ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";
import { LogoutForm } from "@/app/dashboard/logout-form";
import type { DashboardUser } from "./dashboard-shell";

/**
 * Derives up-to-two-letter initials from a display name or email address.
 *
 * @param name - The user's display name.
 * @param email - The user's email address (fallback when name is empty).
 * @returns One or two uppercase initial characters.
 */
export const getInitials = (name: string, email: string): string => {
  const source = name.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

type NavUserProps = {
  /** Authenticated dashboard user. */
  user: DashboardUser;
  /**
   * Injected logout form; defaults to the real LogoutForm for production.
   * Tests can supply a stub.
   */
  LogoutFormComponent?: typeof LogoutForm;
};

/**
 * Sidebar footer user block with a dropdown trigger showing user initials, name, email,
 * and a logout option — matching the Space app's NavUser design.
 *
 * @param props - User info and optional logout form injection for testability.
 */
export const NavUser = ({
  user,
  LogoutFormComponent = LogoutForm,
}: NavUserProps) => {
  const initials = getInitials(user.name, user.email);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initials}
              </span>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/70">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="right"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {initials}
                </span>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-1 pb-1">
              <LogoutFormComponent
                className="w-full"
                variant="ghost"
                buttonClassName="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
              />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
