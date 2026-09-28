import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";

import { TableSkeleton } from "@/components/page-skeletons";

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

export const OverviewActivitySkeleton = () => {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-9 w-32 @xl/main:w-80" />
        <Skeleton className="h-8 w-28" />
      </div>
      <TableSkeleton rows={5} columns={6} />
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
