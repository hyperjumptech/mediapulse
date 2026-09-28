import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

import { PageHeaderSkeleton } from "@/components/page-skeletons";

const range = (count: number) =>
  Array.from({ length: count }, (_, index) => index);

const ExecutionStatCardsSkeleton = () => {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {range(4).map((card) => (
        <Card key={card} className="min-w-0 gap-1 px-4 py-3 shadow-none">
          <div className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-24 max-w-full" />
          </div>
          <div className="flex h-8 items-center">
            <Skeleton className="h-6 w-12" />
          </div>
        </Card>
      ))}
    </div>
  );
};

const OverviewListRowsSkeleton = ({
  rows,
  withBadge,
}: {
  rows: number;
  withBadge: boolean;
}) => {
  return (
    <div className="flex flex-col">
      {range(rows).map((row) => (
        <div key={row} className="flex items-center gap-3 py-2">
          {withBadge ? (
            <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5 w-40 max-w-full" />
            </div>
            <div className="flex h-4 items-center">
              <Skeleton className="h-3 w-24 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
};

const OverviewPanelSkeleton = ({ withBadge }: { withBadge: boolean }) => {
  return (
    <Card className="min-w-0 gap-4 py-5 shadow-none">
      <CardHeader className="gap-1 px-5">
        <Skeleton className="h-4 w-28" />
        <div className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-56 max-w-full" />
        </div>
      </CardHeader>
      <CardContent className="px-5">
        <OverviewListRowsSkeleton rows={4} withBadge={withBadge} />
      </CardContent>
    </Card>
  );
};

export const ExecutionStatsSkeleton = () => {
  return (
    <div role="status" aria-label="Loading">
      <ExecutionStatCardsSkeleton />
    </div>
  );
};

export const OverviewListSkeleton = ({
  rows = 4,
  withBadge = true,
}: {
  rows?: number;
  withBadge?: boolean;
}) => {
  return (
    <div role="status" aria-label="Loading">
      <OverviewListRowsSkeleton rows={rows} withBadge={withBadge} />
    </div>
  );
};

export const OverviewPageSkeleton = () => {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <PageHeaderSkeleton />
      <ExecutionStatCardsSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewPanelSkeleton withBadge />
        <OverviewPanelSkeleton withBadge={false} />
      </div>
    </div>
  );
};
