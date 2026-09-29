import type { ReactNode } from "react";

type PageHeaderProps = {
  description?: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
};

const Description = ({ children }: { children: ReactNode }) => (
  <p className="max-w-3xl text-sm text-muted-foreground">{children}</p>
);

export const PageHeader = ({
  description,
  actions,
  badges,
}: PageHeaderProps) => {
  if (!description && !actions && !badges) {
    return null;
  }
  const leading = badges ? (
    <div
      data-slot="page-header-badges"
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"
    >
      {badges}
    </div>
  ) : description ? (
    <Description>{description}</Description>
  ) : (
    <span />
  );

  return (
    <div data-slot="page-header" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {leading}
        {actions ? (
          <div
            data-slot="page-header-actions"
            className="flex shrink-0 flex-wrap items-center gap-2"
          >
            {actions}
          </div>
        ) : null}
      </div>
      {badges && description ? <Description>{description}</Description> : null}
    </div>
  );
};
