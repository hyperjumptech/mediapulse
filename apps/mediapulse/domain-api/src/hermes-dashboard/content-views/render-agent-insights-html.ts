import type {
  InsightsPayload,
  Widget,
} from "@workspace/agent-data-api-contract";

/**
 * Escapes text for safe inclusion in HTML bodies served to Hermes content views.
 *
 * @param value - Raw string.
 * @returns HTML-escaped string.
 */
export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const renderWidget = (widget: Widget): string => {
  if (widget.kind === "stat") {
    return `<div style="font-size:24px;font-weight:600;">${escapeHtml(String(widget.value))}${widget.unit ? ` ${escapeHtml(widget.unit)}` : ""}</div>`;
  }
  if (widget.kind === "table") {
    const header = widget.columns
      .map(
        (column) =>
          `<th style="text-align:left;padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(column)}</th>`,
      )
      .join("");
    const rows = widget.rows
      .map(
        (row) =>
          `<tr>${row
            .map(
              (cell) =>
                `<td style="padding:8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(cell == null ? "" : String(cell))}</td>`,
            )
            .join("")}</tr>`,
      )
      .join("");
    return `<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<pre style="font-size:12px;overflow:auto;">${escapeHtml(JSON.stringify(widget, null, 2))}</pre>`;
};

/**
 * Renders agent insights as a self-contained HTML document for Hermes iframe views.
 *
 * @param payload - Insights payload from agent-data-api.
 * @returns HTML document string.
 */
export const renderAgentInsightsHtml = (payload: InsightsPayload): string => {
  const kpis = payload.kpis
    .map(
      (
        kpi,
      ) => `<div style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;display:inline-block;min-width:140px;margin-right:8px;">
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;">${escapeHtml(kpi.label)}</div>
        <div style="font-size:24px;font-weight:600;">${escapeHtml(String(kpi.value))}${kpi.unit ? ` ${escapeHtml(kpi.unit)}` : ""}</div>
      </div>`,
    )
    .join("");

  const sections = payload.sections
    .map(
      (section) => `<section style="margin-bottom:24px;">
        <h2 style="font-size:16px;margin:0 0 8px;">${escapeHtml(section.title)}</h2>
        ${section.insight ? `<p style="color:#4b5563;font-size:13px;">${escapeHtml(section.insight)}</p>` : ""}
        ${renderWidget(section.widget)}
      </section>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Agent insights</title></head>
<body style="font-family:system-ui,sans-serif;padding:16px;color:#111827;">
<h1 style="font-size:18px;margin:0 0 16px;">Insights (${escapeHtml(payload.window)})</h1>
<div style="margin-bottom:16px;">${kpis || ""}</div>
${sections || "<p>No insights available for this window.</p>"}
</body></html>`;
};
