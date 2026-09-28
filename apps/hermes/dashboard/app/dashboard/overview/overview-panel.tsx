import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

export const OVERVIEW_ROW_CLASS_NAME =
  "-mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export const OverviewPanel = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => {
  return (
    <Card className="min-w-0 gap-4 py-5 shadow-none">
      <CardHeader className="gap-1 px-5">
        <CardTitle>
          <h2 className="text-base font-semibold">{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5">{children}</CardContent>
    </Card>
  );
};
