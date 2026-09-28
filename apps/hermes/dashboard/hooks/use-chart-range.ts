import { useEffect, useState } from "react";

import { useIsMobile } from "@workspace/ui/hooks/use-mobile";

export type ChartRange = "90d" | "30d" | "7d";

export const CHART_RANGE_DAYS: Record<ChartRange, number> = {
  "90d": 90,
  "30d": 30,
  "7d": 7,
};

export const isChartRange = (value: string): value is ChartRange =>
  value in CHART_RANGE_DAYS;

export const useChartRange = (initialRange: ChartRange = "90d") => {
  const isMobile = useIsMobile();
  const [range, setRange] = useState<ChartRange>(initialRange);

  useEffect(() => {
    if (isMobile) {
      setRange("7d");
    }
  }, [isMobile]);

  const selectRange = (value: string) => {
    if (isChartRange(value)) {
      setRange(value);
    }
  };

  return { range, selectRange };
};
