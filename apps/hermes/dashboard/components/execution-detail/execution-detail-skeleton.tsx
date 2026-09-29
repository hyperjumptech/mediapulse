import { Skeleton } from "@workspace/ui/components/skeleton";

import { PageHeaderSkeleton, TableSkeleton } from "@/components/page-skeletons";

const STAT_CARD_KEYS = ["started", "duration", "succeeded", "failed"];

export const ExecutionDetailSkeleton = () => {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4">
        {STAT_CARD_KEYS.map((statCardKey) => (
          <Skeleton key={statCardKey} className="h-[4.25rem] rounded-xl" />
        ))}
      </div>
      <TableSkeleton rows={3} columns={6} />
      <TableSkeleton rows={6} columns={8} />
    </div>
  );
};
