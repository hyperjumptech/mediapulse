import type {
  ChronicleDownstreamStage,
  ChroniclePayload,
  ChronicleProviderUsage,
  ChronicleRun,
  ChronicleStage,
  ChronicleStatus,
  ChronicleUpstreamStage,
} from "../../resources/newsletters/build-chronicle";

import { escapeHtml } from "./render-agent-insights-html";

/** Badge colors keyed by chronicle status. */
const STATUS_COLORS: Record<ChronicleStatus, { bg: string; fg: string }> = {
  success: { bg: "#dcfce7", fg: "#15803d" },
  partial: { bg: "#fef3c7", fg: "#b45309" },
  failed: { bg: "#fee2e2", fg: "#b91c1c" },
  skipped: { bg: "#f1f5f9", fg: "#6b7280" },
  empty: { bg: "#f1f5f9", fg: "#6b7280" },
};

const numberFmt = (value: number): string => value.toLocaleString("en-US");

const badge = (status: ChronicleStatus): string => {
  const color = STATUS_COLORS[status];
  return `<span style="display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;background:${color.bg};color:${color.fg};">${escapeHtml(status)}</span>`;
};

const durationLabel = (durationMs: number | null): string => {
  if (durationMs === null) return "—";
  if (durationMs < 1000) return `${String(durationMs)}ms`;
  const seconds = durationMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${String(minutes)}m ${String(rest)}s`;
};

const whenLabel = (
  startedAt: string | null,
  completedAt: string | null,
): string => {
  if (startedAt === null && completedAt === null) return "—";
  return `${escapeHtml(startedAt ?? "?")} → ${escapeHtml(completedAt ?? "?")}`;
};

const providerLabel = (providers: ChronicleProviderUsage[]): string => {
  if (providers.length === 0) return "—";
  return providers
    .map((provider) => {
      const parts = [escapeHtml(provider.name)];
      if (provider.calls !== undefined)
        parts.push(`×${String(provider.calls)}`);
      if (provider.credits !== undefined)
        parts.push(`· ${String(provider.credits)} credits`);
      return parts.join(" ");
    })
    .join(", ");
};

const tile = (label: string, value: string): string =>
  `<div style="background:#f1f5f9;border-radius:12px;padding:12px 14px;">
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">${escapeHtml(label)}</div>
    <div style="font-size:19px;font-weight:700;margin-top:3px;">${escapeHtml(value)}</div>
  </div>`;

const statChip = (label: string, value: string): string =>
  `<div style="border:1px solid #e5e8ec;border-radius:10px;padding:8px 12px;min-width:104px;">
    <div style="font-size:10.5px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;font-weight:600;">${escapeHtml(label)}</div>
    <div style="font-size:14px;font-weight:600;margin-top:2px;">${escapeHtml(value)}</div>
  </div>`;

/** Renders the per-run drill-down table for an upstream stage. */
const renderRunsTable = (runs: ChronicleRun[]): string => {
  if (runs.length === 0) return "";
  const rows = runs
    .map(
      (run) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;font-family:monospace;font-size:12px;white-space:nowrap;">${whenLabel(run.startedAt, run.completedAt)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;text-align:right;">${escapeHtml(durationLabel(run.durationMs))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;text-align:right;">${escapeHtml(run.tokens ? numberFmt(run.tokens.totalTokens) : "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;">${providerLabel(run.providers)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;">${badge(run.status)}</td>
      </tr>`,
    )
    .join("");

  return `<details style="margin-top:12px;">
    <summary style="cursor:pointer;font-size:12.5px;color:#4f46e5;font-weight:600;">Runs (${String(runs.length)})</summary>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Started → completed</th>
        <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Duration</th>
        <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Tokens</th>
        <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Providers</th>
        <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Status</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </details>`;
};

/** Renders the article-analysis classification sample table. */
const renderClassificationTable = (
  details: Record<string, unknown>,
): string => {
  const sample = Array.isArray(details.sample) ? details.sample : [];
  if (sample.length === 0) return "";
  const rows = sample
    .map((entry) => {
      const row = entry as {
        title?: unknown;
        section?: unknown;
        score?: unknown;
        reason?: unknown;
      };
      const title = typeof row.title === "string" ? row.title : "—";
      const section =
        typeof row.section === "string" ? row.section : "rejected";
      const score = typeof row.score === "number" ? row.score.toFixed(2) : "—";
      const reason = typeof row.reason === "string" ? row.reason : "—";
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;">${escapeHtml(title)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;">${escapeHtml(section)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;text-align:right;">${escapeHtml(score)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eef1f4;">${escapeHtml(reason)}</td>
      </tr>`;
    })
    .join("");

  return `<details style="margin-top:12px;">
    <summary style="cursor:pointer;font-size:12.5px;color:#4f46e5;font-weight:600;">Per-article classification (${String(sample.length)})</summary>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px;">
      <thead><tr>
        <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Title</th>
        <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Section</th>
        <th style="text-align:right;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Score</th>
        <th style="text-align:left;padding:6px 8px;color:#6b7280;font-size:11px;text-transform:uppercase;">Reason</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </details>`;
};

const cardShell = (
  title: string,
  suffix: string,
  when: string,
  status: ChronicleStatus,
  body: string,
): string => {
  const color = STATUS_COLORS[status];
  return `<div style="background:#fff;border:1px solid #e5e8ec;border-left:4px solid ${color.fg};border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:0 1px 2px rgba(16,24,40,.05);">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
      <div>
        <div style="font-weight:700;font-size:16px;">${escapeHtml(title)}${suffix}</div>
        <div style="color:#6b7280;font-size:12px;margin-top:3px;">🕑 ${when}</div>
      </div>
      ${badge(status)}
    </div>
    ${body}
  </div>`;
};

const renderUpstreamStage = (stage: ChronicleUpstreamStage): string => {
  const suffix = ` <span style="font-size:11px;font-weight:700;color:#4f46e5;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:1px 7px;">${String(stage.runCount)} runs</span>`;
  const when = `window ${escapeHtml(stage.windowStart)} → ${escapeHtml(stage.windowEnd)}`;

  const fetchProviders = Object.entries(stage.totals.fetchByProvider)
    .map(([name, count]) => `${escapeHtml(name)} ×${String(count)}`)
    .join(", ");

  const stats = [
    statChip("Σ Tokens", numberFmt(stage.totals.tokens.totalTokens)),
    stage.totals.searchCredits > 0
      ? statChip("Σ Search credits", numberFmt(stage.totals.searchCredits))
      : "",
    fetchProviders.length > 0 ? statChip("Fetch", fetchProviders) : "",
  ]
    .filter((chip) => chip.length > 0)
    .join("");

  const detailTable =
    stage.stage === "article-analysis"
      ? renderClassificationTable(stage.details)
      : renderRunsTable(stage.runs);

  const body = `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">${stats}</div>${detailTable}`;
  return cardShell(stage.label, suffix, when, stage.status, body);
};

const renderDownstreamStage = (stage: ChronicleDownstreamStage): string => {
  const run = stage.run;
  const when = run ? whenLabel(run.startedAt, run.completedAt) : "not started";

  const stats: string[] = [];
  if (run?.model) stats.push(statChip("Model", run.model));
  if (run?.tokens)
    stats.push(statChip("Tokens", numberFmt(run.tokens.totalTokens)));
  if (run) stats.push(statChip("Duration", durationLabel(run.durationMs)));
  if (run && run.providers.length > 0)
    stats.push(statChip("Provider", providerLabel(run.providers)));

  const errorBlock = run?.error
    ? `<div style="background:#fee2e2;color:#7f1d1d;border:1px solid #fca5a5;border-radius:10px;padding:9px 12px;font-size:12.5px;margin-top:12px;">
        <strong>${escapeHtml(run.error.code ?? "error")}</strong>${run.error.category ? ` · ${escapeHtml(run.error.category)}` : ""}${run.error.message ? `<br>${escapeHtml(run.error.message)}` : ""}
      </div>`
    : "";

  const statsBlock =
    stats.length > 0
      ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">${stats.join("")}</div>`
      : `<div style="color:#6b7280;font-size:13px;margin-top:12px;">${escapeHtml(String(stage.details.reason ?? "No run for this newsletter."))}</div>`;

  return cardShell(
    stage.label,
    "",
    when,
    stage.status,
    `${statsBlock}${errorBlock}`,
  );
};

const renderStage = (stage: ChronicleStage): string =>
  stage.kind === "upstream"
    ? renderUpstreamStage(stage)
    : renderDownstreamStage(stage);

/**
 * Renders the full newsletter Chronicle as a self-contained HTML document.
 *
 * @param chronicle - The assembled chronicle payload.
 * @returns HTML document string for the dashboard content-view iframe.
 */
export const renderNewsletterChronicleHtml = (
  chronicle: ChroniclePayload,
): string => {
  const stagesHtml = chronicle.stages.map(renderStage).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chronicle</title></head>
<body style="font-family:system-ui,-apple-system,sans-serif;padding:24px 20px;color:#0f172a;background:#f6f7f9;">
<div style="max-width:960px;margin:0 auto;">
  <div style="background:#fff;border:1px solid #e5e8ec;border-radius:16px;padding:22px 24px;box-shadow:0 1px 2px rgba(16,24,40,.05);margin-bottom:16px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
      <div>
        <h1 style="font-size:20px;font-weight:700;margin:0;">${escapeHtml(chronicle.subject)}</h1>
        <div style="color:#6b7280;font-size:13px;margin-top:3px;">Generated ${escapeHtml(chronicle.generatedAt)}</div>
        <div style="margin-top:8px;font-size:12.5px;color:#334155;background:#f1f5f9;display:inline-block;padding:3px 10px;border-radius:7px;">🗓 Window ${escapeHtml(chronicle.windowStart)} → ${escapeHtml(chronicle.windowEnd)}</div>
      </div>
      ${badge(chronicle.overallStatus)}
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px;">
      ${tile("Σ LLM tokens", numberFmt(chronicle.totalTokens))}
      ${tile("Σ Search credits", numberFmt(chronicle.totalSearchCredits))}
      ${tile("Upstream runs", `${numberFmt(chronicle.upstreamRunCount)} in window`)}
      ${tile("Status", chronicle.overallStatus)}
    </div>
    <div style="margin-top:18px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:9px 12px;font-size:12.5px;">⚠ ${escapeHtml(chronicle.attributionNote)}</div>
  </div>
  ${stagesHtml}
</div>
</body></html>`;
};
