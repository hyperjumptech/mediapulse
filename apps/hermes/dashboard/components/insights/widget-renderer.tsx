"use client";

import type { Widget } from "@workspace/agent-data-api-contract";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type WidgetRendererProps = {
  widget: Widget;
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatTs(ts: string): string {
  const date = new Date(ts);
  if (isNaN(date.getTime())) return ts;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Renders a single insight widget by kind.
 *
 * @param widget - The widget to render.
 */
export const WidgetRenderer = ({ widget }: WidgetRendererProps) => {
  if (widget.kind === "stat") {
    const isPositive = widget.delta !== undefined && widget.delta > 0;
    const isNegative = widget.delta !== undefined && widget.delta < 0;
    const deltaColor = isPositive
      ? "text-emerald-600"
      : isNegative
        ? "text-red-500"
        : "text-muted-foreground";
    const DeltaIcon = isPositive
      ? TrendingUp
      : isNegative
        ? TrendingDown
        : Minus;

    return (
      <div className="py-2">
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold tracking-tight text-foreground">
            {widget.value}
          </span>
          {widget.unit && (
            <span className="mb-1 text-base text-muted-foreground">
              {widget.unit}
            </span>
          )}
        </div>
        {widget.delta !== undefined && (
          <div
            className={`mt-1.5 flex items-center gap-1 text-sm font-medium ${deltaColor}`}
          >
            <DeltaIcon className="h-3.5 w-3.5" />
            <span>
              {widget.delta > 0 ? "+" : ""}
              {widget.delta} vs prior period
            </span>
          </div>
        )}
      </div>
    );
  }

  if (widget.kind === "timeSeries") {
    const config: ChartConfig = {
      value: { label: widget.unit ?? "Value", color: "var(--chart-1)" },
    };

    return (
      <ChartContainer config={config} className="h-48 w-full">
        <AreaChart
          data={widget.points}
          margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-value)"
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor="var(--color-value)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} className="stroke-border/40" />
          <XAxis
            dataKey="ts"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
            tickFormatter={formatTs}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickMargin={4}
          />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={formatTs} />}
          />
          <Area
            type="natural"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill="url(#gradValue)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ChartContainer>
    );
  }

  if (widget.kind === "categoryBar") {
    const config: ChartConfig = {
      value: { label: widget.unit ?? "Value", color: "var(--chart-1)" },
    };

    return (
      <ChartContainer config={config} className="h-48 w-full">
        <BarChart
          data={widget.bars}
          margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
        >
          <CartesianGrid vertical={false} className="stroke-border/40" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickMargin={4}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    );
  }

  if (widget.kind === "histogram") {
    const config: ChartConfig = {
      count: { label: "Count", color: "var(--chart-1)" },
    };

    return (
      <ChartContainer config={config} className="h-48 w-full">
        <BarChart
          data={widget.buckets}
          margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
        >
          <CartesianGrid vertical={false} className="stroke-border/40" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11 }}
            tickMargin={4}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar
            dataKey="count"
            fill="var(--color-count)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    );
  }

  if (widget.kind === "funnel") {
    const firstValue = widget.stages[0]?.value ?? 0;

    return (
      <ul className="space-y-2.5 py-2">
        {widget.stages.map((stage, index) => {
          const percentage =
            firstValue > 0 ? Math.round((stage.value / firstValue) * 100) : 100;
          const color = CHART_COLORS[index % CHART_COLORS.length];

          return (
            <li key={stage.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{stage.label}</span>
                <span className="tabular-nums font-medium text-foreground">
                  {stage.value.toLocaleString()}
                  <span className="ml-1.5 text-muted-foreground">
                    {percentage}%
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${percentage}%`, backgroundColor: color }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  if (widget.kind === "breakdown") {
    const config: ChartConfig = Object.fromEntries(
      widget.slices.map((slice, index) => [
        slice.label,
        {
          label: slice.label,
          color: CHART_COLORS[index % CHART_COLORS.length],
        },
      ]),
    );
    const data = widget.slices.map((slice) => ({
      label: slice.label,
      value: slice.value,
    }));

    return (
      <div className="space-y-4">
        <ChartContainer config={config} className="h-40 w-full">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
          >
            <CartesianGrid vertical={false} className="stroke-border/40" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={4}
            />
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <ul className="space-y-1.5">
          {widget.slices.map((slice, index) => {
            const percentage = Math.round(slice.fraction * 100);
            const color = CHART_COLORS[index % CHART_COLORS.length];

            return (
              <li key={slice.label} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 text-muted-foreground">
                  {slice.label}
                </span>
                <span className="tabular-nums font-medium text-foreground">
                  {slice.value.toLocaleString()}
                </span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">
                  {percentage}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (widget.kind === "table") {
    return (
      <div className="overflow-x-auto py-2">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {widget.columns.map((column) => (
                <th
                  key={column}
                  className="border-b border-border/60 pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {widget.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/30 transition-colors hover:bg-muted/30"
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="py-2 pr-4 tabular-nums text-foreground"
                  >
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="py-2 text-sm text-muted-foreground">
      Unsupported widget kind
    </div>
  );
};
