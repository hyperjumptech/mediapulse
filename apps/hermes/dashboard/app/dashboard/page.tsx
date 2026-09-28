import { Suspense } from "react";

import { ActiveExecutionsSection } from "./overview/active-executions-section";
import { ExecutionActivitySection } from "./overview/execution-activity-section";
import { ExecutionStatsSection } from "./overview/execution-stats-section";
import { OverviewActivityTabs } from "./overview/overview-activity-tabs";
import {
  ExecutionActivitySkeleton,
  ExecutionStatsSkeleton,
  OverviewListSkeleton,
} from "./overview/overview-skeletons";
import { RecentFailuresSection } from "./overview/recent-failures-section";
import { UpcomingSchedulesSection } from "./overview/upcoming-schedules-section";

const DashboardPage = () => (
  <>
    <Suspense fallback={<ExecutionStatsSkeleton />}>
      <ExecutionStatsSection />
    </Suspense>
    <Suspense fallback={<ExecutionActivitySkeleton />}>
      <ExecutionActivitySection />
    </Suspense>
    <OverviewActivityTabs
      running={
        <Suspense fallback={<OverviewListSkeleton />}>
          <ActiveExecutionsSection />
        </Suspense>
      }
      failed={
        <Suspense fallback={<OverviewListSkeleton />}>
          <RecentFailuresSection />
        </Suspense>
      }
      upcoming={
        <Suspense fallback={<OverviewListSkeleton withBadge={false} />}>
          <UpcomingSchedulesSection />
        </Suspense>
      }
    />
  </>
);

export default DashboardPage;
