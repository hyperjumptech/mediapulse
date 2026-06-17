import type { ContentGenerationRunListItem } from "@workspace/agent-data-api-contract";

import { escapeHtml } from "./render-agent-insights-html";

/**
 * Renders a paginated list of content-generation runs as HTML.
 *
 * @param items - Run rows from agent-data-api.
 * @returns HTML document string.
 */
export const renderContentGenerationRunsHtml = (
  items: ContentGenerationRunListItem[],
): string => {
  const rows = items
    .map(
      (run) => `<tr>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;font-family:monospace;font-size:12px;">${escapeHtml(run.id)}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(run.tickerId ?? "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(run.outcome ?? "—")}</td>
        <td style="padding:8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(run.createdAt)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>CGA diagnostics</title></head>
<body style="font-family:system-ui,sans-serif;padding:16px;color:#111827;">
<h1 style="font-size:18px;margin:0 0 16px;">Content generation runs</h1>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
<thead><tr>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Run id</th>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Ticker</th>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Outcome</th>
<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">Started</th>
</tr></thead>
<tbody>${rows || `<tr><td colspan="4" style="padding:12px;color:#6b7280;">No runs found.</td></tr>`}</tbody>
</table>
</body></html>`;
};
