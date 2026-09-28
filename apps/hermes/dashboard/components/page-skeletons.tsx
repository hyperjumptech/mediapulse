import { Skeleton } from "@workspace/ui/components/skeleton";

const range = (count: number) =>
  Array.from({ length: count }, (_, index) => index);

export const PageHeaderSkeleton = () => {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
};

export const TableSkeleton = ({
  rows = 8,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) => {
  return (
    <div className="overflow-hidden rounded-md border" aria-hidden>
      <div className="flex gap-4 border-b bg-muted/50 px-4 py-3">
        {range(columns).map((column) => (
          <Skeleton key={column} className="h-4 flex-1" />
        ))}
      </div>
      {range(rows).map((row) => (
        <div key={row} className="flex gap-4 border-b px-4 py-3 last:border-0">
          {range(columns).map((column) => (
            <Skeleton key={column} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const ListBodySkeleton = ({ columns = 5 }: { columns?: number }) => {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading">
      <Skeleton className="h-9 w-full max-w-sm" />
      <TableSkeleton columns={columns} />
    </div>
  );
};

export const ListPageSkeleton = ({ columns = 5 }: { columns?: number }) => {
  return <ListBodySkeleton columns={columns} />;
};

export const SectionSkeleton = ({ rows = 6 }: { rows?: number }) => {
  return (
    <div role="status" aria-label="Loading">
      <TableSkeleton rows={rows} />
    </div>
  );
};

export const DetailPageSkeleton = () => {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <PageHeaderSkeleton />
      <div
        data-slot="summary-grid-skeleton"
        className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border px-4 py-4 sm:px-5 md:grid-cols-3 lg:grid-cols-4"
      >
        {range(4).map((item) => (
          <div key={item} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
};

export const FormPageSkeleton = () => {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading">
      <div className="flex max-w-2xl flex-col gap-5">
        {range(4).map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
};
