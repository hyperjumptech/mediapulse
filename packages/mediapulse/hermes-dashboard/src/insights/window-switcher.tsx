"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SimpleTooltip } from "@workspace/ui/components/tooltip";

type InsightsWindow = "24h" | "7d" | "30d";

const WINDOWS: { value: InsightsWindow; label: string; description: string }[] =
  [
    { value: "24h", label: "24h", description: "Data from the last 24 hours" },
    { value: "7d", label: "7d", description: "Data from the last 7 days" },
    { value: "30d", label: "30d", description: "Data from the last 30 days" },
  ];

type WindowSwitcherProps = {
  current: InsightsWindow;
};

/**
 * Three-button switcher that updates the `insightsWindow` URL search param.
 *
 * @param current - The currently active window value.
 */
export const WindowSwitcher = ({ current }: WindowSwitcherProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClick = (window: InsightsWindow) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("insightsWindow", window);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-1">
      {WINDOWS.map(({ value, label, description }) => (
        <SimpleTooltip key={value} content={description}>
          <button
            type="button"
            onClick={() => handleClick(value)}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              current === value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        </SimpleTooltip>
      ))}
    </div>
  );
};
