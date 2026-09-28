import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

type OverviewActivityTabsProps = {
  running: ReactNode;
  failed: ReactNode;
  upcoming: ReactNode;
};

export const OverviewActivityTabs = ({
  running,
  failed,
  upcoming,
}: OverviewActivityTabsProps) => (
  <Card className="@container/card">
    <Tabs defaultValue="running" className="gap-4">
      <CardHeader className="flex flex-col gap-3 @[540px]/card:flex-row @[540px]/card:items-center @[540px]/card:justify-between">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            What is running, what failed, and what runs next.
          </CardDescription>
        </div>
        <TabsList>
          <TabsTrigger value="running">Running</TabsTrigger>
          <TabsTrigger value="failed">Failed (7d)</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        </TabsList>
      </CardHeader>
      <CardContent>
        <TabsContent value="running">{running}</TabsContent>
        <TabsContent value="failed">{failed}</TabsContent>
        <TabsContent value="upcoming">{upcoming}</TabsContent>
      </CardContent>
    </Tabs>
  </Card>
);
