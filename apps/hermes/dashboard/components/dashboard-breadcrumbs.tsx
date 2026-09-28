"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, Suspense, use, useMemo } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { cn } from "@workspace/ui/lib/utils";

import {
  buildDashboardBreadcrumbs,
  type DashboardBreadcrumb,
  type DomainIntegrationNav,
} from "@/lib/dashboard-routes";

import { useBreadcrumbEntityLabels } from "./breadcrumb-entity-label";

type DashboardBreadcrumbsProps = {
  domainIntegrations: Promise<DomainIntegrationNav[]>;
};

type DashboardBreadcrumbTrailProps = {
  domainIntegrations: readonly DomainIntegrationNav[];
};

type DashboardBreadcrumbEntryProps = {
  breadcrumb: DashboardBreadcrumb;
  isCurrentPage: boolean;
};

const noDomainIntegrations: readonly DomainIntegrationNav[] = [];

const useDashboardBreadcrumbs = (
  domainIntegrations: readonly DomainIntegrationNav[],
) => {
  const pathname = usePathname();
  const entityLabels = useBreadcrumbEntityLabels();

  return useMemo(
    () =>
      buildDashboardBreadcrumbs({
        pathname,
        domainIntegrations,
        entityLabels,
      }),
    [pathname, domainIntegrations, entityLabels],
  );
};

const DashboardBreadcrumbEntry = ({
  breadcrumb,
  isCurrentPage,
}: DashboardBreadcrumbEntryProps) => {
  if (isCurrentPage) {
    return (
      <BreadcrumbPage className="truncate font-medium">
        {breadcrumb.label}
      </BreadcrumbPage>
    );
  }

  if (breadcrumb.href) {
    return (
      <BreadcrumbLink asChild className="truncate">
        <Link href={breadcrumb.href}>{breadcrumb.label}</Link>
      </BreadcrumbLink>
    );
  }

  return <span className="truncate">{breadcrumb.label}</span>;
};

const DashboardBreadcrumbTrail = ({
  domainIntegrations,
}: DashboardBreadcrumbTrailProps) => {
  const breadcrumbs = useDashboardBreadcrumbs(domainIntegrations);
  const lastIndex = breadcrumbs.length - 1;

  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap sm:gap-2">
        {breadcrumbs.map((breadcrumb, index) => {
          const isCurrentPage = index === lastIndex;
          const ancestorClassName = isCurrentPage
            ? undefined
            : "hidden md:flex";

          return (
            <Fragment key={`${index}-${breadcrumb.label}`}>
              {index > 0 ? (
                <BreadcrumbSeparator className="hidden shrink-0 md:block" />
              ) : null}
              <BreadcrumbItem className={cn("min-w-0", ancestorClassName)}>
                <DashboardBreadcrumbEntry
                  breadcrumb={breadcrumb}
                  isCurrentPage={isCurrentPage}
                />
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

const ResolvedDashboardBreadcrumbs = ({
  domainIntegrations,
}: DashboardBreadcrumbsProps) => {
  const resolvedDomainIntegrations = use(domainIntegrations);

  return (
    <DashboardBreadcrumbTrail domainIntegrations={resolvedDomainIntegrations} />
  );
};

export const DashboardBreadcrumbs = ({
  domainIntegrations,
}: DashboardBreadcrumbsProps) => (
  <Suspense
    fallback={
      <DashboardBreadcrumbTrail domainIntegrations={noDomainIntegrations} />
    }
  >
    <ResolvedDashboardBreadcrumbs domainIntegrations={domainIntegrations} />
  </Suspense>
);
