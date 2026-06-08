import type { InsightsPayload, InsightSection } from "@workspace/agent-data-api-contract";

import { WidgetRenderer } from "@/components/insights/widget-renderer";
import { WindowSwitcher } from "./window-switcher";

type InsightsWindow = "24h" | "7d" | "30d";

type InsightsTabProps = {
  payload: InsightsPayload;
  agentId: string;
  window: InsightsWindow;
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
  critical: "border-red-200 bg-red-50 text-red-800",
};

/**
 * Renders the Insights tab for an agent detail page.
 *
 * @param payload - Insights payload from the agent-data-api.
 * @param agentId - The agent identifier (for reference).
 * @param window - The active time window.
 */
export const InsightsTab = ({ payload, agentId: _agentId, window }: InsightsTabProps) => {
  const categories = Array.from(
    new Set(payload.sections.map((section) => section.category)),
  );

  const sectionsByCategory = categories.reduce<Record<string, InsightSection[]>>(
    (accumulator, category) => {
      accumulator[category] = payload.sections.filter(
        (section) => section.category === category,
      );

      return accumulator;
    },
    {},
  );

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Insights
        </h2>
        <WindowSwitcher current={window} />
      </div>

      <section>
        {payload.alerts.length > 0 ? (
          <ul className="space-y-2">
            {payload.alerts.map((alert) => {
              const styleClass =
                SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES["info"];

              return (
                <li
                  key={alert.id}
                  className={`rounded-lg border px-4 py-3 text-sm ${styleClass}`}
                >
                  {alert.message}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            All healthy
          </div>
        )}
      </section>

      {payload.kpis.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            KPIs
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {payload.kpis.map((kpi) => {
              const deltaSign =
                kpi.delta !== undefined && kpi.delta >= 0 ? "+" : "";
              const deltaColor =
                kpi.delta === undefined
                  ? ""
                  : kpi.delta >= 0
                    ? "text-green-600"
                    : "text-red-600";

              return (
                <div
                  key={kpi.id}
                  className="rounded-lg border border-border/50 bg-muted/25 px-4 py-3"
                >
                  <div className="text-xs text-muted-foreground">{kpi.label}</div>
                  <div className="mt-1 text-xl font-bold text-foreground">
                    {kpi.value}
                    {kpi.unit && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {kpi.unit}
                      </span>
                    )}
                  </div>
                  {kpi.delta !== undefined && (
                    <div className={`mt-0.5 text-xs font-medium ${deltaColor}`}>
                      {deltaSign}
                      {kpi.delta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {categories.map((category) => (
        <section key={category}>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h3>
          <div className="space-y-6">
            {(sectionsByCategory[category] ?? []).map((section) => (
              <div
                key={section.id}
                className="rounded-lg border border-border/50 bg-muted/25 px-6 py-4"
              >
                <h4 className="mb-1 text-sm font-semibold text-foreground">
                  {section.title}
                </h4>
                {section.insight && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    {section.insight}
                  </p>
                )}
                <WidgetRenderer widget={section.widget} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
