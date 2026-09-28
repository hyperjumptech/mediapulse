import { Skeleton } from "@workspace/ui/components/skeleton";

import { PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";

const STAT_CARD_KEYS = [
  "run-status",
  "enqueue-status",
  "started",
  "jobs",
  "invocations",
  "transport",
];

export const ExecutionDetailSkeleton = () => {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <PageHeaderSkeleton />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {STAT_CARD_KEYS.map((statCardKey) => (
          <Skeleton key={statCardKey} className="h-[4.5rem] rounded-xl" />
        ))}
      </div>
      <TableSkeleton rows={3} columns={6} />
      <TableSkeleton rows={6} columns={8} />
    </div>
  );
};
