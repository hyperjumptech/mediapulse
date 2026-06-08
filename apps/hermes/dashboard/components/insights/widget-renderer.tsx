"use client";

import type { Widget } from "@workspace/agent-data-api-contract";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

type WidgetRendererProps = {
  widget: Widget;
};

/**
 * Renders a single insight widget by kind.
 *
 * @param widget - The widget to render.
 */
export const WidgetRenderer = ({ widget }: WidgetRendererProps) => {
  if (widget.kind === "stat") {
    const deltaSign = widget.delta !== undefined && widget.delta >= 0 ? "+" : "";
    const deltaColor =
      widget.delta === undefined
        ? ""
        : widget.delta >= 0
          ? "text-green-600"
          : "text-red-600";

    return (
      <div className="py-4">
        <span className="text-4xl font-bold text-foreground">
          {widget.value}
        </span>
        {widget.unit && (
          <span className="ml-1 text-lg text-muted-foreground">
            {widget.unit}
          </span>
        )}
        {widget.delta !== undefined && (
          <div className={`mt-1 text-sm font-medium ${deltaColor}`}>
            {deltaSign}
            {widget.delta}
          </div>
        )}
      </div>
    );
  }

  if (widget.kind === "timeSeries") {
    const data = widget.points.map((point) => ({
      ts: point.ts,
      value: point.value,
    }));

    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="ts" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit={widget.unit} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#6366f1"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (widget.kind === "categoryBar") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={widget.bars}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit={widget.unit} />
          <Tooltip />
          <Bar dataKey="value" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.kind === "histogram") {
    const data = widget.buckets.map((bucket) => ({
      label: bucket.label,
      count: bucket.count,
    }));

    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#6366f1" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (widget.kind === "funnel") {
    const firstValue = widget.stages[0]?.value ?? 0;

    return (
      <ul className="space-y-2 py-2">
        {widget.stages.map((stage) => {
          const percentage =
            firstValue > 0
              ? Math.round((stage.value / firstValue) * 100)
              : 100;

          return (
            <li key={stage.label} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-muted-foreground">
                {stage.label}
              </span>
              <span className="font-medium text-foreground">{stage.value}</span>
              <span className="text-muted-foreground">({percentage}%)</span>
            </li>
          );
        })}
      </ul>
    );
  }

  if (widget.kind === "breakdown") {
    return (
      <ul className="space-y-2 py-2">
        {widget.slices.map((slice) => {
          const percentage = Math.round(slice.fraction * 100);

          return (
            <li key={slice.label} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 text-muted-foreground">
                {slice.label}
              </span>
              <span className="font-medium text-foreground">{slice.value}</span>
              <span className="text-muted-foreground">({percentage}%)</span>
            </li>
          );
        })}
      </ul>
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
              <tr key={rowIndex} className="border-b border-border/30">
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="py-2 pr-4 text-foreground"
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

  return <div className="py-2 text-sm text-muted-foreground">Unsupported widget kind</div>;
};
