"use client";

import type { ReactNode, Ref } from "react";
import { CircleCheck, ShieldCheck } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";

import { ExecutionsDataTable } from "@/components/executions/executions-data-table";
import type { ColumnVisibility } from "@/lib/data-table/column-visibility";
import type { OverviewActivity } from "@/lib/dashboard-overview";

import {
  formatActivityCount,
  OVERVIEW_ACTIVITY_TABLE_IDS,
  OVERVIEW_ACTIVITY_VIEW_LABELS,
  OVERVIEW_ACTIVITY_VIEWS,
  OVERVIEW_FAILURE_WINDOW_DAYS,
  type OverviewActivityView,
} from "./overview-activity-views";
import { UpcomingSchedulesTable } from "./upcoming-schedules-table";
import { useOverviewActivityView } from "./use-overview-activity-view";

const VIEW_SELECT_ID = "overview-activity-view";

type ActivityCounts = Record<OverviewActivityView, string | null>;

type ActivityViewSwitcherProps = {
  view: OverviewActivityView;
  counts: ActivityCounts;
  onViewChange: (view: string) => void;
  switcherRef: Ref<HTMLDivElement>;
};

const ActivityViewSwitcher = ({
  view,
  counts,
  onViewChange,
  switcherRef,
}: ActivityViewSwitcherProps) => (
  <div ref={switcherRef} className="flex items-center">
    <Label htmlFor={VIEW_SELECT_ID} className="sr-only">
      View
    </Label>
    <Select value={view} onValueChange={onViewChange}>
      <SelectTrigger
        id={VIEW_SELECT_ID}
        size="sm"
        className="flex w-fit @xl/main:hidden"
      >
        <SelectValue placeholder="Select a view" />
      </SelectTrigger>
      <SelectContent>
        {OVERVIEW_ACTIVITY_VIEWS.map((activityView) => (
          <SelectItem key={activityView} value={activityView}>
            {OVERVIEW_ACTIVITY_VIEW_LABELS[activityView]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <TabsList className="hidden **:data-[slot=badge]:h-5 **:data-[slot=badge]:min-w-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 **:data-[slot=badge]:tabular-nums @xl/main:flex">
      {OVERVIEW_ACTIVITY_VIEWS.map((activityView) => (
        <TabsTrigger key={activityView} value={activityView}>
          {OVERVIEW_ACTIVITY_VIEW_LABELS[activityView]}{" "}
          {counts[activityView] ? (
            <Badge variant="secondary">{counts[activityView]}</Badge>
          ) : null}
        </TabsTrigger>
      ))}
    </TabsList>
  </div>
);

const ActivityPanel = ({
  value,
  activeView,
  children,
}: {
  value: OverviewActivityView;
  activeView: OverviewActivityView;
  children: ReactNode;
}) => (
  <TabsContent value={value} forceMount hidden={value !== activeView}>
    {children}
  </TabsContent>
);

type OverviewActivityTabsProps = {
  activity: OverviewActivity;
  columnVisibility: Record<OverviewActivityView, ColumnVisibility>;
};

export const OverviewActivityTabs = ({
  activity,
  columnVisibility,
}: OverviewActivityTabsProps) => {
  const { view, changeView, viewSwitcherRef } = useOverviewActivityView();
  const counts: ActivityCounts = {
    running: formatActivityCount(
      activity.running.rows.length,
      activity.running.hasMore,
    ),
    failed: formatActivityCount(
      activity.failed.rows.length,
      activity.failed.hasMore,
    ),
    upcoming: formatActivityCount(
      activity.upcoming.rows.length,
      activity.upcoming.hasMore,
    ),
  };
  const switcher = (
    <ActivityViewSwitcher
      view={view}
      counts={counts}
      onViewChange={changeView}
      switcherRef={viewSwitcherRef}
    />
  );
  const switcherFor = (panelView: OverviewActivityView) =>
    panelView === view ? switcher : undefined;

  return (
    <Tabs value={view} onValueChange={changeView} className="gap-4">
      <ActivityPanel value="running" activeView={view}>
        <ExecutionsDataTable
          tableId={OVERVIEW_ACTIVITY_TABLE_IDS.running}
          rows={activity.running.rows}
          toolbarFilters={switcherFor("running")}
          emptyIcon={CircleCheck}
          emptyTitle="Nothing is running right now"
          emptyDescription="Pending and running executions show up here."
          initialColumnVisibility={columnVisibility.running}
        />
      </ActivityPanel>
      <ActivityPanel value="failed" activeView={view}>
        <ExecutionsDataTable
          tableId={OVERVIEW_ACTIVITY_TABLE_IDS.failed}
          rows={activity.failed.rows}
          toolbarFilters={switcherFor("failed")}
          emptyIcon={ShieldCheck}
          emptyTitle={`No failed runs in the last ${OVERVIEW_FAILURE_WINDOW_DAYS} days`}
          emptyDescription="Failed and partial runs show up here for a week."
          initialColumnVisibility={columnVisibility.failed}
        />
      </ActivityPanel>
      <ActivityPanel value="upcoming" activeView={view}>
        <UpcomingSchedulesTable
          tableId={OVERVIEW_ACTIVITY_TABLE_IDS.upcoming}
          schedules={activity.upcoming.rows}
          toolbarFilters={switcherFor("upcoming")}
          initialColumnVisibility={columnVisibility.upcoming}
        />
      </ActivityPanel>
    </Tabs>
  );
};
