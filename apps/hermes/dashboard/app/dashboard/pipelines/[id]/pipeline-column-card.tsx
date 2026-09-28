import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from "@workspace/ui/components/card";

export const PipelineColumnCard = ({
  title,
  description,
  action,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) => {
  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardHeader
        data-slot="pipeline-column-header"
        className="sticky top-0 z-10 gap-1 rounded-t-xl border-b bg-card px-4 py-3 [.border-b]:pb-3"
      >
        <h2 className="flex min-w-0 items-center gap-2 text-sm leading-none font-semibold text-foreground">
          {title}
        </h2>
        {description ? (
          <CardDescription className="min-w-0 truncate text-xs">
            {description}
          </CardDescription>
        ) : null}
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 py-4">
        {children}
      </CardContent>
    </Card>
  );
};
