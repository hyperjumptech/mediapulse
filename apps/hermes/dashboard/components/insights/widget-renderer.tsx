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

import { formatCompactDuration, isDurationUnit } from "@/lib/format-duration";

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
    const isDuration = isDurationUnit(widget.unit);
    const numericValue = Number(widget.value);
    const displayValue = isDuration
      ? isNaN(numericValue)
        ? String(widget.value)
        : formatCompactDuration(numericValue)
      : String(widget.value);
    const isPositive =
      !isDuration && widget.delta !== undefined && widget.delta > 0;
    const isNegative =
      !isDuration && widget.delta !== undefined && widget.delta < 0;
    const deltaColor = isDuration
      ? "text-muted-foreground"
      : isPositive
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
            {displayValue}
          </span>
          {!isDuration && widget.unit && (
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
              {isDuration
                ? formatCompactDuration(Math.abs(widget.delta))
                : `${widget.delta > 0 ? "+" : ""}${widget.delta}`}{" "}
              vs prior period
            </span>
          </div>
        )}
      </div>
    );
  }

  if (widget.kind === "timeSeries") {
    const isTimeSeriesDuration = isDurationUnit(widget.unit);
    const yTickFormatter = isTimeSeriesDuration
      ? (value: number) => formatCompactDuration(value)
      : undefined;
    const config: ChartConfig = {
      value: { label: widget.unit ?? "Value", color: "var(--chart-1)" },
    };

    return (
      <ChartContainer config={config} className="h-48 w-full">
        <AreaChart
          data={widget.points}
          margin={{ top: 10, right: 4, left: 0, bottom: 0 }}
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
            width={36}
            tickFormatter={yTickFormatter}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={formatTs}
                formatter={
                  isTimeSeriesDuration
                    ? (value) => formatCompactDuration(Number(value))
                    : undefined
                }
              />
            }
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
    const isCategoryBarDuration = isDurationUnit(widget.unit);
    const yTickFormatter = isCategoryBarDuration
      ? (value: number) => formatCompactDuration(value)
      : undefined;
    const config: ChartConfig = {
      value: { label: widget.unit ?? "Value", color: "var(--chart-1)" },
    };

    return (
      <ChartContainer config={config} className="h-48 w-full">
        <BarChart
          data={widget.bars}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
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
            width={36}
            tickFormatter={yTickFormatter}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={
                  isCategoryBarDuration
                    ? (value) => formatCompactDuration(Number(value))
                    : undefined
                }
              />
            }
          />
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
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
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
            width={36}
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
          const prevValue = widget.stages[index - 1]?.value ?? 0;
          const drop = index > 0 ? prevValue - stage.value : 0;
          const dropPct =
            index > 0 && prevValue > 0
              ? Math.round((drop / prevValue) * 100)
              : 0;
          const percentage =
            firstValue > 0 ? Math.round((stage.value / firstValue) * 100) : 100;
          const color = CHART_COLORS[index % CHART_COLORS.length];

          return (
            <li key={stage.label} className="space-y-1">
              {index > 0 && drop > 0 && (
                <p className="pb-0.5 text-right text-xs leading-none text-muted-foreground/60">
                  {`−${drop.toLocaleString()} (${dropPct}% dropped)`}
                </p>
              )}
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
    const dominantIndex = widget.slices.reduce(
      (maxIndex, slice, index) =>
        slice.fraction > (widget.slices[maxIndex]?.fraction ?? 0)
          ? index
          : maxIndex,
      0,
    );
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
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
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
              width={36}
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
            const isDominant = index === dominantIndex;

            return (
              <li key={slice.label} className="flex items-center gap-2 text-xs">
                <span
                  className={`shrink-0 rounded-sm ${isDominant ? "h-2.5 w-2.5" : "h-2 w-2"}`}
                  style={{ backgroundColor: color }}
                />
                <span
                  className={`flex-1 ${isDominant ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
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
