"use client";

import * as React from "react";
import { ResponsiveContainer, Tooltip } from "recharts";

import { cn } from "@workspace/ui/lib/utils";

/** Chart config: keys map to series with optional label and color (CSS var or hex). */
export type ChartConfig = Record<
  string,
  { label?: string; color?: string } & Record<string, unknown>
>;

const ChartContext = React.createContext<ChartConfig>({});

/**
 * Wraps a Recharts chart with responsive sizing and injects config as CSS variables (--color-{key}).
 */
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { config?: ChartConfig }
>(({ config = {}, className, children, style, ...props }, ref) => {
  const styleWithVars = React.useMemo(() => {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(config)) {
      if (value?.color) vars[`--color-${key}`] = value.color;
    }
    return { ...style, ...vars } as React.CSSProperties;
  }, [config, style]);

  return (
    <ChartContext.Provider value={config}>
      <div
        ref={ref}
        className={cn("w-full", className)}
        style={styleWithVars}
        {...props}
      >
        <ResponsiveContainer width="100%" height="100%">
          {React.Children.only(children) as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

type ChartTooltipContentProps = {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    fill?: string;
    payload?: Record<string, unknown>;
  }>;
  label?: string;
  labelFormatter?: (label: string) => string;
  nameKey?: string;
  hideLabel?: boolean;
  indicator?: "line" | "dot" | "dashed";
  className?: string;
};

/**
 * Default tooltip content for charts. Use with Recharts Tooltip content prop.
 */
const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      payload = [],
      label,
      labelFormatter,
      nameKey,
      hideLabel = false,
      indicator = "dot",
      className,
    },
    ref,
  ) => {
    const config = React.useContext(ChartContext);
    if (!active || !payload?.length) return null;

    const displayLabel =
      label != null
        ? labelFormatter
          ? labelFormatter(String(label))
          : String(label)
        : null;

    return (
      <div
        ref={ref}
        className={cn(
          "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
          className,
        )}
      >
        {!hideLabel && displayLabel ? (
          <div className="font-medium">{displayLabel}</div>
        ) : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const name = nameKey
              ? (item.payload?.[nameKey] ?? item.name ?? item.dataKey)
              : (item.name ?? item.dataKey);
            const configEntry = config[String(item.dataKey)];
            const displayName = configEntry?.label ?? String(name);
            const fill = item.fill ?? configEntry?.color;

            return (
              <div
                key={index}
                className={cn(
                  "flex w-full items-stretch gap-2",
                  indicator === "dot" && "items-center",
                )}
              >
                {indicator !== "line" && (
                  <div
                    className={cn(
                      "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                      indicator === "dot" && "h-2.5 w-2.5",
                      indicator === "dashed" &&
                        "w-0 border-[1.5px] border-dashed bg-transparent",
                    )}
                    style={
                      {
                        "--color-bg": fill,
                        "--color-border": fill,
                      } as React.CSSProperties
                    }
                  />
                )}
                <div className="flex flex-1 justify-between leading-none items-center">
                  <span className="text-muted-foreground">{displayName}</span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {typeof item.value === "number"
                      ? item.value.toLocaleString()
                      : item.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltipContent";

/**
 * Recharts Tooltip with ChartTooltipContent as default content. Pass content={<ChartTooltipContent />} or custom content.
 */
const ChartTooltip = ({
  content,
  ...props
}: React.ComponentProps<typeof Tooltip>) => (
  <Tooltip
    content={content ?? <ChartTooltipContent />}
    cursor={false}
    {...props}
  />
);
ChartTooltip.displayName = "ChartTooltip";

export { ChartContainer, ChartTooltip, ChartTooltipContent };
