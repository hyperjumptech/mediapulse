import type { ReactNode } from "react";

type PageHeaderProps = {
  description?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
};

export const PageHeader = ({
  description,
  actions,
  badges,
}: PageHeaderProps) => {
  if (!description && !actions && !badges) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        {badges ? (
          <div
            data-slot="page-header-badges"
            className="flex flex-wrap items-center gap-2"
          >
            {badges}
          </div>
        ) : null}
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
