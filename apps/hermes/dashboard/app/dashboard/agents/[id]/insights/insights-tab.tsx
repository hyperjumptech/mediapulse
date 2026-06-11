"use client";

import type {
  InsightsPayload,
  InsightSection,
} from "@workspace/agent-data-api-contract";
import { SimpleTooltip } from "@workspace/ui/components/tooltip";

import { WidgetRenderer } from "@/components/insights/widget-renderer";
import { WindowSwitcher } from "./window-switcher";

type InsightsWindow = "24h" | "7d" | "30d";

type InsightsTabProps = {
  payload: InsightsPayload;
  window: InsightsWindow;
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
  critical: "border-red-200 bg-red-50 text-red-800",
};

const KPI_CARD_STYLES: Record<string, string> = {
  neutral: "border-border/50 bg-muted/25",
  positive:
    "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40",
  warning:
    "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40",
  critical: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
};

const KPI_VALUE_STYLES: Record<string, string> = {
  neutral: "text-foreground",
  positive: "text-green-700 dark:text-green-400",
  warning: "text-yellow-700 dark:text-yellow-400",
  critical: "text-red-700 dark:text-red-400",
};

const CATEGORY_HINTS: Record<string, string> = {
  what: "What happened — event and activity breakdowns",
  when: "When it happened — timing and frequency patterns",
  where: "Where it happened — location or segment distribution",
  who: "Who was involved — actor or entity breakdowns",
  why: "Why it happened — root cause and contributing factors",
  how: "How it happened — process and funnel analysis",
  other: "Additional metrics and observations",
};

function sectionTooltip(section: InsightSection): string {
  return section.insight ?? CATEGORY_HINTS[section.category] ?? "";
}

/**
 * Renders the Insights tab for an agent detail page.
 *
 * @param payload - Insights payload from the agent-data-api.
 * @param window - The active time window.
 */
export const InsightsTab = ({ payload, window }: InsightsTabProps) => {
  const categories = Array.from(
    new Set(payload.sections.map((section) => section.category)),
  );

  const sectionsByCategory = categories.reduce<
    Record<string, InsightSection[]>
  >((accumulator, category) => {
    accumulator[category] = payload.sections.filter(
      (section) => section.category === category,
    );

    return accumulator;
  }, {});

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
              const cardStyle =
                KPI_CARD_STYLES[kpi.tone ?? "neutral"] ??
                KPI_CARD_STYLES["neutral"];
              const valueStyle =
                KPI_VALUE_STYLES[kpi.tone ?? "neutral"] ??
                KPI_VALUE_STYLES["neutral"];
              const tooltipText =
                kpi.delta !== undefined
                  ? `${kpi.label} — change vs prior period`
                  : kpi.label;

              return (
                <SimpleTooltip key={kpi.id} content={tooltipText}>
                  <div
                    className={`rounded-lg border px-4 py-3 ${cardStyle} cursor-default`}
                  >
                    <div className="text-xs text-muted-foreground">
                      {kpi.label}
                    </div>
                    <div className={`mt-1 text-xl font-bold ${valueStyle}`}>
                      {kpi.value}
                      {kpi.unit && (
                        <span className="ml-1 text-sm font-normal text-muted-foreground">
                          {kpi.unit}
                        </span>
                      )}
                    </div>
                    {kpi.delta !== undefined && (
                      <div
                        className={`mt-0.5 text-xs font-medium ${deltaColor}`}
                      >
                        {deltaSign}
                        {kpi.delta}
                      </div>
                    )}
                  </div>
                </SimpleTooltip>
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
            {(sectionsByCategory[category] ?? []).map((section) => {
              const tooltip = sectionTooltip(section);

              return (
                <div
                  key={section.id}
                  className="rounded-lg border border-border/50 bg-muted/25 px-6 py-4"
                >
                  {tooltip ? (
                    <SimpleTooltip content={tooltip}>
                      <h4 className="mb-1 inline-block text-sm font-semibold text-foreground cursor-default">
                        {section.title}
                      </h4>
                    </SimpleTooltip>
                  ) : (
                    <h4 className="mb-1 text-sm font-semibold text-foreground">
                      {section.title}
                    </h4>
                  )}
                  {section.insight && (
                    <p className="mb-3 text-sm text-muted-foreground">
                      {section.insight}
                    </p>
                  )}
                  <WidgetRenderer widget={section.widget} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
