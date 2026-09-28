"use client";

import { useTheme } from "next-themes";
import {
  ChevronsUpDown,
  Monitor,
  Moon,
  Sun,
  SunMoon,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";

import { LogoutForm } from "@/app/dashboard/logout-form";

import type { DashboardUser } from "./dashboard-shell";

export type ThemePreference = "light" | "dark" | "system";

type ThemeOption = {
  value: ThemePreference;
  label: string;
  icon: LucideIcon;
};

type NavUserProps = {
  user: DashboardUser;
  LogoutFormComponent?: typeof LogoutForm;
};

type UserSummaryProps = {
  user: DashboardUser;
  initials: string;
};

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const DEFAULT_THEME_PREFERENCE: ThemePreference = "system";

const isThemePreference = (value: string): value is ThemePreference =>
  themeOptions.some((option) => option.value === value);

export const getInitials = (name: string, email: string): string => {
  const source = name.trim() || email;
  const [firstPart, secondPart] = source.split(/[\s@._-]+/).filter(Boolean);

  if (firstPart && secondPart) {
    return `${firstPart.charAt(0)}${secondPart.charAt(0)}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
};

export const useThemePreference = () => {
  const { theme, setTheme } = useTheme();
  const themePreference =
    theme && isThemePreference(theme) ? theme : DEFAULT_THEME_PREFERENCE;

  const setThemePreference = (value: string) => {
    if (isThemePreference(value)) {
      setTheme(value);
    }
  };

  return { themePreference, setThemePreference };
};

const UserSummary = ({ user, initials }: UserSummaryProps) => (
  <>
    <Avatar className="size-8 rounded-lg">
      <AvatarFallback className="rounded-lg border border-sidebar-border bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
    <span className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{user.name}</span>
      <span className="truncate text-xs text-muted-foreground">
        {user.email}
      </span>
    </span>
  </>
);

const ThemeMenu = () => {
  const { themePreference, setThemePreference } = useThemePreference();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <SunMoon />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-36">
        <DropdownMenuRadioGroup
          value={themePreference}
          onValueChange={setThemePreference}
        >
          {themeOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

export const NavUser = ({
  user,
  LogoutFormComponent = LogoutForm,
}: NavUserProps) => {
  const { isMobile } = useSidebar();
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
              <UserSummary user={user} initials={initials} />
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5">
                <UserSummary user={user} initials={initials} />
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ThemeMenu />
            <DropdownMenuSeparator />
            <LogoutFormComponent
              className="w-full"
              variant="ghost"
              buttonClassName="h-auto w-full justify-start gap-2 rounded-sm px-2 py-1.5 text-sm font-normal text-foreground hover:bg-accent hover:text-accent-foreground"
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
