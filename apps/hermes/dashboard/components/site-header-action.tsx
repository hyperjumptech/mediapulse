"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use } from "react";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@workspace/ui/components/button";

import {
  DASHBOARD_ROOT_PATH,
  resolveDashboardPrimaryAction,
  type DomainIntegrationNav,
} from "@/lib/dashboard-routes";

import { QuickCreateMenu } from "./quick-create-menu";

type SiteHeaderActionProps = {
  domainIntegrations: Promise<DomainIntegrationNav[]>;
};

const noDomainIntegrations: readonly DomainIntegrationNav[] = [];

const PrimaryAction = ({
  domainIntegrations,
}: {
  domainIntegrations: readonly DomainIntegrationNav[];
}) => {
  const pathname = usePathname();
  if (pathname === DASHBOARD_ROOT_PATH) {
    return <QuickCreateMenu />;
  }
  const action = resolveDashboardPrimaryAction(pathname, domainIntegrations);
  if (!action) {
    return null;
  }
  const ActionIcon = action.intent === "edit" ? Pencil : Plus;

  return (
    <Button size="sm" asChild>
      <Link href={action.href} scroll={false} aria-label={action.label}>
        <ActionIcon aria-hidden />
        <span className="hidden sm:inline">{action.label}</span>
      </Link>
    </Button>
  );
};

const ResolvedPrimaryAction = ({
  domainIntegrations,
}: SiteHeaderActionProps) => {
  const resolvedDomainIntegrations = use(domainIntegrations);

  return <PrimaryAction domainIntegrations={resolvedDomainIntegrations} />;
};

export const SiteHeaderAction = ({
  domainIntegrations,
}: SiteHeaderActionProps) => (
  <Suspense
    fallback={<PrimaryAction domainIntegrations={noDomainIntegrations} />}
  >
    <ResolvedPrimaryAction domainIntegrations={domainIntegrations} />
  </Suspense>
);
