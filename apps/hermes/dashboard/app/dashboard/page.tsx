import { Suspense } from "react";

import { ExecutionActivitySection } from "./overview/execution-activity-section";
import { ExecutionStatsSection } from "./overview/execution-stats-section";
import { OverviewActivitySection } from "./overview/overview-activity-section";
import {
  ExecutionActivitySkeleton,
  ExecutionStatsSkeleton,
  OverviewActivitySkeleton,
} from "./overview/overview-skeletons";

const DashboardPage = () => (
  <>
    <Suspense fallback={<ExecutionStatsSkeleton />}>
      <ExecutionStatsSection />
    </Suspense>
    <Suspense fallback={<ExecutionActivitySkeleton />}>
      <ExecutionActivitySection />
    </Suspense>
    <Suspense fallback={<OverviewActivitySkeleton />}>
      <OverviewActivitySection />
    </Suspense>
  </>
);

export default DashboardPage;
