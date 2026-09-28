"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";

import {
  CHART_RANGE_DAYS,
  useChartRange,
  type ChartRange,
} from "@/hooks/use-chart-range";
import type { ExecutionDailyPoint } from "@/lib/dashboard-overview";
import { formatDayKey } from "@/lib/date-time/day-key";

const chartConfig = {
  total: {
    label: "Runs",
    color: "var(--primary)",
  },
  failed: {
    label: "Failed",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

const RANGE_OPTIONS: { value: ChartRange; label: string; long: string }[] = [
  { value: "90d", label: "Last 3 months", long: "the last 3 months" },
  { value: "30d", label: "Last 30 days", long: "the last 30 days" },
  { value: "7d", label: "Last 7 days", long: "the last 7 days" },
];

const labelForDay = (value: unknown): string =>
  typeof value === "string" ? formatDayKey(value) : "";

export const ExecutionActivityChart = ({
  points,
}: {
  points: readonly ExecutionDailyPoint[];
}) => {
  const { range, selectRange } = useChartRange();
  const visiblePoints = points.slice(-CHART_RANGE_DAYS[range]);
  const selectedOption =
    RANGE_OPTIONS.find((option) => option.value === range) ?? RANGE_OPTIONS[0];
  const totalRuns = visiblePoints.reduce((sum, point) => sum + point.total, 0);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Executions</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            {totalRuns.toLocaleString("en-US")} runs in {selectedOption?.long}
          </span>
          <span className="@[540px]/card:hidden">{selectedOption?.label}</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={selectRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            {RANGE_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={selectRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a range"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {RANGE_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="rounded-lg"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={visiblePoints}>
            <defs>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-total)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-total)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-failed)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-failed)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={labelForDay}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={labelForDay}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="total"
              type="natural"
              fill="url(#fillTotal)"
              stroke="var(--color-total)"
            />
            <Area
              dataKey="failed"
              type="natural"
              fill="url(#fillFailed)"
              stroke="var(--color-failed)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};
