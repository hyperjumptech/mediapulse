import { Suspense } from "react";

import { PageHeader } from "@/components/page-header";

import { ActiveExecutionsSection } from "./overview/active-executions-section";
import { ExecutionStatsSection } from "./overview/execution-stats-section";
import { OverviewPanel } from "./overview/overview-panel";
import {
  ExecutionStatsSkeleton,
  OverviewListSkeleton,
} from "./overview/overview-skeletons";
import { RecentFailuresSection } from "./overview/recent-failures-section";
import { UpcomingSchedulesSection } from "./overview/upcoming-schedules-section";

const DashboardPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="What Hermes is running now and what needs attention."
      />
      <Suspense fallback={<ExecutionStatsSkeleton />}>
        <ExecutionStatsSection />
      </Suspense>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <OverviewPanel
          title="Running now"
          description="Pending and running executions, newest first."
        >
          <Suspense fallback={<OverviewListSkeleton />}>
            <ActiveExecutionsSection />
          </Suspense>
        </OverviewPanel>
        <OverviewPanel
          title="Upcoming runs"
          description="The next enabled schedules due to run."
        >
          <Suspense fallback={<OverviewListSkeleton withBadge={false} />}>
            <UpcomingSchedulesSection />
          </Suspense>
        </OverviewPanel>
      </div>
      <OverviewPanel
        title="Recent failures (7 days)"
        description="Failed and partial runs, newest first."
      >
        <Suspense fallback={<OverviewListSkeleton />}>
          <RecentFailuresSection />
        </Suspense>
      </OverviewPanel>
    </div>
  );
};

export default DashboardPage;
