import type { SectionCoverageVersionRow } from "@workspace/agent-data-api-contract";

import { escapeHtml } from "./render-agent-insights-html";

/**
 * Renders section coverage rollup rows as HTML for Hermes content views.
 *
 * @param rows - Per-version rollup rows.
 * @param tickerId - Selected ticker id.
 * @param windowDays - Rolling window in days.
 * @returns HTML document string.
 */
export const renderSectionCoverageHtml = (
  rows: SectionCoverageVersionRow[],
  tickerId: string,
  windowDays: number,
): string => {
  const tableRows = rows
    .map((row) => {
      const sectionSummary = Object.entries(row.bySection)
        .map(
          ([sectionId, entry]) =>
            `${escapeHtml(sectionId)}: coverage ${entry.avgCoverage.toFixed(1)}, fill ${entry.avgFill ?? "—"}`,
        )
        .join("<br/>");
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(row.contractVersion ?? "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(String(row.coverageRunCount))}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(String(row.fillRunCount))}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-size:12px;">${sectionSummary || "—"}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Section coverage</title></head>
<body style="font-family:system-ui,sans-serif;padding:16px;color:#111827;">
<h1 style="font-size:18px;margin:0 0 8px;">Section coverage</h1>
<p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Ticker ${escapeHtml(tickerId)} · last ${windowDays} days</p>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead><tr>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Version</th>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Coverage runs</th>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Fill runs</th>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">By section</th>
</tr></thead>
<tbody>${tableRows || `<tr><td colspan="4" style="padding:12px;color:#6b7280;">No rollup data.</td></tr>`}</tbody>
</table>
</body></html>`;
};
