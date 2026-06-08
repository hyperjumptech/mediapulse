"use client";

import { useRouter, useSearchParams } from "next/navigation";

type InsightsWindow = "24h" | "7d" | "30d";

const WINDOWS: { value: InsightsWindow; label: string }[] = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
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
      {WINDOWS.map(({ value, label }) => (
        <button
          key={value}
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
      ))}
    </div>
  );
};
