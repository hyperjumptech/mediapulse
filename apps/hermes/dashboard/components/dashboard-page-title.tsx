"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useMemo } from "react";

import {
  buildDashboardBreadcrumbs,
  resolveDashboardPageTitle,
  type DashboardBreadcrumb,
  type DomainIntegrationNav,
} from "@/lib/dashboard-routes";

import { useBreadcrumbEntityLabels } from "./breadcrumb-entity-label";

type DashboardPageTitleProps = {
  domainIntegrations: Promise<DomainIntegrationNav[]>;
};

const noDomainIntegrations: readonly DomainIntegrationNav[] = [];

const useDashboardPageTitle = (
  domainIntegrations: readonly DomainIntegrationNav[],
) => {
  const pathname = usePathname();
  const entityLabels = useBreadcrumbEntityLabels();

  return useMemo(
    () =>
      resolveDashboardPageTitle(
        buildDashboardBreadcrumbs({
          pathname,
          domainIntegrations,
          entityLabels,
        }),
      ),
    [pathname, domainIntegrations, entityLabels],
  );
};

const ParentCrumb = ({ parent }: { parent: DashboardBreadcrumb }) => (
  <span className="hidden min-w-0 items-center gap-1.5 text-muted-foreground md:flex">
    {parent.href ? (
      <Link
        href={parent.href}
        className="truncate transition-colors hover:text-foreground"
      >
        {parent.label}
      </Link>
    ) : (
      <span className="truncate">{parent.label}</span>
    )}
    <span aria-hidden>/</span>
  </span>
);

const PageTitle = ({
  domainIntegrations,
}: {
  domainIntegrations: readonly DomainIntegrationNav[];
}) => {
  const { title, parent } = useDashboardPageTitle(domainIntegrations);

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-base">
      {parent ? <ParentCrumb parent={parent} /> : null}
      <h1 className="truncate font-medium">{title}</h1>
    </div>
  );
};

const ResolvedPageTitle = ({ domainIntegrations }: DashboardPageTitleProps) => {
  const resolvedDomainIntegrations = use(domainIntegrations);

  return <PageTitle domainIntegrations={resolvedDomainIntegrations} />;
};

export const DashboardPageTitle = ({
  domainIntegrations,
}: DashboardPageTitleProps) => (
  <Suspense fallback={<PageTitle domainIntegrations={noDomainIntegrations} />}>
    <ResolvedPageTitle domainIntegrations={domainIntegrations} />
  </Suspense>
);
