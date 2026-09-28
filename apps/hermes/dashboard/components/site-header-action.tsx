"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import {
  DASHBOARD_ROOT_PATH,
  resolveDashboardPrimaryAction,
} from "@/lib/dashboard-routes";

import { QuickCreateMenu } from "./quick-create-menu";

export const SiteHeaderAction = () => {
  const pathname = usePathname();
  if (pathname === DASHBOARD_ROOT_PATH) {
    return <QuickCreateMenu />;
  }
  const action = resolveDashboardPrimaryAction(pathname);
  if (!action) {
    return null;
  }

  return (
    <Button size="sm" asChild>
      <Link href={action.href} scroll={false} aria-label={action.label}>
        <Plus aria-hidden />
        <span className="hidden sm:inline">{action.label}</span>
      </Link>
    </Button>
  );
};
