import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { cn } from "@workspace/ui/lib/utils";

import type { Trend, TrendDirection } from "@/lib/overview-trends";

const TREND_ICON: Record<TrendDirection, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

export type StatCardProps = {
  label: string;
  value: ReactNode;
  trend?: Trend | null;
  headline?: ReactNode;
  description?: ReactNode;
  valueClassName?: string;
};

export const StatCard = ({
  label,
  value,
  trend,
  headline,
  description,
  valueClassName,
}: StatCardProps) => {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
            valueClassName,
          )}
        >
          {value}
        </CardTitle>
        {trend && TrendIcon ? (
          <CardAction>
            <Badge variant="outline">
              <TrendIcon />
              {trend.label}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      {headline || description ? (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {headline ? (
            <div className="line-clamp-1 flex items-center gap-2 font-medium">
              {headline}
              {TrendIcon ? <TrendIcon className="size-4" /> : null}
            </div>
          ) : null}
          {description ? (
            <div className="text-muted-foreground">{description}</div>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
};

export const StatCardGrid = ({ children }: { children: ReactNode }) => (
  <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
    {children}
  </div>
);

export type StatTileProps = {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  labelAddon?: ReactNode;
  valueClassName?: string;
};

export const StatTile = ({
  label,
  value,
  caption,
  labelAddon,
  valueClassName,
}: StatTileProps) => (
  <Card data-slot="stat-tile" className="min-w-0 gap-1 px-4 py-3 shadow-none">
    <dt className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
      <span className="truncate">{label}</span>
      {labelAddon}
    </dt>
    <dd className="flex min-w-0 flex-col gap-0.5">
      <span
        className={cn(
          "text-lg leading-snug font-semibold break-words text-foreground tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </span>
      {caption ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          {caption}
        </span>
      ) : null}
    </dd>
  </Card>
);

export const StatTileGrid = ({ children }: { children: ReactNode }) => (
  <dl
    data-slot="stat-tile-grid"
    className="grid grid-cols-2 gap-3 @3xl/main:grid-cols-4"
  >
    {children}
  </dl>
);
