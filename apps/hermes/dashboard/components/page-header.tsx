import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
};

export const PageHeader = ({
  title,
  description,
  actions,
  badges,
}: PageHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words text-foreground">
            {title}
          </h1>
          {badges ? (
            <div
              data-slot="page-header-badges"
              className="flex shrink-0 flex-wrap items-center gap-2"
            >
              {badges}
            </div>
          ) : null}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div
          data-slot="page-header-actions"
          className="flex shrink-0 flex-wrap items-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
};
