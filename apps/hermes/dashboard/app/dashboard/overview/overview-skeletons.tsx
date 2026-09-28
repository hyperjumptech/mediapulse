import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

const range = (count: number) =>
  Array.from({ length: count }, (_, index) => index);

const ExecutionStatCardsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {range(4).map((card) => (
        <Card key={card} className="min-w-0 gap-4">
          <CardHeader className="gap-3">
            <Skeleton className="h-3.5 w-24 max-w-full" />
            <Skeleton className="h-8 w-20" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-40 max-w-full" />
            <Skeleton className="h-3 w-32 max-w-full" />
          </CardContent>
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
            <Skeleton className="h-5 w-24 shrink-0 rounded-full" />
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

const ActivityCardSkeleton = () => {
  return (
    <Card className="min-w-0 gap-4">
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3.5 w-56 max-w-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full" />
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

export const ExecutionActivitySkeleton = () => {
  return (
    <div role="status" aria-label="Loading">
      <ActivityCardSkeleton />
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
    <div
      className="flex flex-col gap-4 md:gap-6"
      role="status"
      aria-label="Loading"
    >
      <ExecutionStatCardsSkeleton />
      <ActivityCardSkeleton />
    </div>
  );
};
