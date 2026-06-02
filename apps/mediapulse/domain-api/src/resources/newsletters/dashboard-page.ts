import type { DashboardPageInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";
import { newslettersCustomActionsForManifest } from "./custom-actions";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const newslettersHermesPathSegment = "newsletters" as const;

/**
 * Threshold (in hours) above which the active SearchQuerySet section gets a
 * `stale set` badge. Lives in one place so the manifest and any future test
 * fixtures stay in sync.
 */
export const NEWSLETTER_STALE_SET_HOURS = 24 as const;

/**
 * `keyValue` block describing the newsletter metadata header. The ticker name
 * row is wired as a link back to the tickers resource so reviewers can jump
 * straight to the source. The token row uses the contract's `tokens` format to
 * render `prompt + completion = total` and gracefully handle partial nulls.
 */
const newslettersMetadataBlock = {
  type: "keyValue",
  label: "Metadata",
  rows: [
    { field: "id", label: "Newsletter id", copyAction: true },
    { field: "subject", label: "Subject", copyAction: true },
    { field: "tickerSymbol", label: "Ticker", copyAction: true },
    {
      field: "tickerName",
      label: "Ticker name",
      linkTemplate: "/dashboard/{integrationId}/tickers/{tickerId}",
    },
    { field: "createdAt", label: "Created", format: "date-time" },
    { field: "model", label: "Model" },
    { field: "agentVersion", label: "Agent version" },
    { field: "configVersion", label: "Config version" },
    { field: "promptHash", label: "Prompt hash", copyAction: true },
    {
      field: "configSnapshotId",
      label: "Config snapshot id",
      copyAction: true,
    },
    {
      field: "totalTokens",
      label: "Tokens",
      format: "tokens",
      tokenFields: {
        prompt: "promptTokens",
        completion: "completionTokens",
        total: "totalTokens",
      },
    },
  ],
} satisfies DetailBlock;

/**
 * `markdown` block bound to the newsletter body. Clamps at 4,000 characters
 * for bodies that exceed 10,000 characters (per PRD REQ-007); shorter bodies
 * render fully without an expander. `copyAction` is intentionally off in this
 * ticket; #466 turns it on after the polish review.
 */
const newslettersBodyBlock = {
  type: "markdown",
  label: "Body",
  field: "content",
  clampChars: 4000,
  clampThreshold: 10000,
  copyAction: true,
} satisfies DetailBlock;

/**
 * `subTable` block bound to `citations` — deduplicated `[title](url)` and
 * `Read the full article: <url>` references in the newsletter body. The `url`
 * column renders as an external link with `rel="noopener noreferrer"`. The
 * caption template surfaces the unique-count alongside the section header so
 * reviewers can sanity-check at a glance.
 */
const newslettersCitationsBlock = {
  type: "subTable",
  label: "Citations",
  field: "citations",
  captionTemplate: "Citations ({citations.length} unique)",
  emptyState: "No citations parsed from this newsletter.",
  columns: [
    { field: "title", label: "Title", type: "text" },
    { field: "domain", label: "Domain", type: "text" },
    {
      field: "url",
      label: "URL",
      type: "text",
      linkTemplate: "{url}",
      linkExternal: true,
      truncate: 80,
    },
  ],
} satisfies DetailBlock;

/**
 * `subTable` block bound to `recipients` (PRD §5). Each row carries
 * `displayName` (`Name <email>` or email), the four-state status badge with
 * its `inconsistent` marker, the Resend email id, attempts, error category,
 * a truncated last-error message, and the checkpoint deliveredAt timestamp.
 * The caption template reuses the numerator/denominator from the list cell
 * via the response fields seeded by `buildRecipients`.
 */
const newslettersRecipientsBlock = {
  type: "subTable",
  label: "Recipients",
  field: "recipients",
  captionTemplate:
    "Recipients (delivered {recipientsDeliveredCount} / enabled at send time {recipientsEnabledAtSendTime})",
  emptyState: "No enabled subscribers for this ticker.",
  sectionRule: {
    when: "recipientsDeliveredCount < recipientsEnabledAtSendTime",
    badge: "warning",
    label: "partial delivery",
  },
  columns: [
    { field: "displayName", label: "Subscriber", type: "text" },
    {
      field: "status",
      label: "Status",
      type: "badge",
      badgeVariants: {
        delivered: "success",
        failed: "destructive",
        skipped: "muted",
        not_attempted: "outline",
      },
      inconsistentField: "inconsistent",
    },
    {
      field: "resendEmailId",
      label: "Resend id",
      type: "text",
      truncate: 16,
      copyAction: true,
    },
    { field: "attempts", label: "Attempts", type: "number" },
    { field: "errorCategory", label: "Error category", type: "text" },
    {
      field: "lastErrorMessage",
      label: "Last error",
      type: "text",
      truncate: 80,
    },
    { field: "deliveredAt", label: "Delivered at", type: "date-time" },
  ],
} satisfies DetailBlock;

/**
 * `subTable` block bound to `selectedSources` (PRD §5). The Title column
 * links to the data-sources detail page so reviewers can jump straight to
 * the source row. Window boundaries appear in the section caption.
 */
const newslettersSelectedSourcesBlock = {
  type: "subTable",
  label: "Selected sources",
  field: "selectedSources",
  captionTemplate:
    "Sources selected in window {selectedSourcesWindow.start} → {selectedSourcesWindow.end}",
  emptyState:
    "No selected sources match the calendar-day window for this newsletter.",
  sectionRule: {
    when: "selectedSources.length == 0",
    badge: "muted",
    label: "no sources",
  },
  columns: [
    {
      field: "title",
      label: "Title",
      type: "text",
      truncate: 80,
      linkTemplate: "/dashboard/{integrationId}/data-sources/{id}",
    },
    { field: "domain", label: "Domain", type: "text" },
    { field: "score", label: "Score", type: "number" },
    { field: "scoredAt", label: "Scored at", type: "date-time" },
  ],
} satisfies DetailBlock;

/**
 * `subTable` block bound to `activeQuerySet.queries` (PRD §5). Each row links
 * to the search-queries page filtered by this newsletter's ticker. The caption
 * shows the active set's generation date and source.
 */
const newslettersSearchQueriesBlock = {
  type: "subTable",
  label: "Search queries",
  field: "activeQuerySet.queries",
  captionTemplate:
    "Active set generated {activeQuerySet.generatedAt} (source: {activeQuerySet.generationSource})",
  emptyState: "No active SearchQuerySet on this newsletter's generation date.",
  sectionRule: {
    when: `hoursBetween(activeQuerySet.generatedAt, createdAt) > ${NEWSLETTER_STALE_SET_HOURS}`,
    badge: "muted",
    label: "stale set",
  },
  columns: [
    {
      field: "text",
      label: "Query",
      type: "text",
      truncate: 80,
      linkTemplate:
        "/dashboard/{integrationId}/search-queries?tickerId={tickerId}",
    },
    { field: "intent", label: "Intent", type: "text" },
    { field: "source", label: "Source", type: "text" },
    { field: "rank", label: "Rank", type: "number" },
  ],
} satisfies DetailBlock;

/**
 * `htmlPreview` block bound to `emailPreviewHtml` — the production
 * `default-newsletter` React Email template rendered server-side against the
 * newsletter's data. The Hermes generic renderer drops this into a sandboxed
 * iframe (`sandbox="allow-popups"`), so the preview is a visual sanity check
 * rather than a forensic record of what Resend received.
 */
const newslettersEmailPreviewBlock = {
  type: "htmlPreview",
  label: "Email preview",
  field: "emailPreviewHtml",
} satisfies DetailBlock;

/**
 * `keyValue` block linking each delivery row back to the Hermes execution
 * surface. Missing template variables fall back to plain text (see
 * `renderUrlTemplate` in `@hermes/domain-contract`), which is what the
 * detail page does when ids on the response are `null`.
 */
const newslettersHermesLinksBlock = {
  type: "keyValue",
  label: "Hermes execution links",
  rows: [
    {
      field: "hermesLinks.hermesScheduleId",
      label: "Schedule",
      linkTemplate: "/dashboard/schedules/{hermesLinks.hermesScheduleId}",
      copyAction: true,
    },
    {
      field: "hermesLinks.scheduleExecutionId",
      label: "Schedule execution",
      linkTemplate:
        "/dashboard/schedules/{hermesLinks.hermesScheduleId}/executions/{hermesLinks.scheduleExecutionId}",
      copyAction: true,
    },
    {
      field: "hermesLinks.hermesExecutionId",
      label: "Execution",
      linkTemplate: "/dashboard/executions/{hermesLinks.hermesExecutionId}",
      copyAction: true,
    },
    {
      field: "hermesLinks.pipelineRunId",
      label: "Pipeline run",
      linkTemplate: "/dashboard/pipelines/runs/{hermesLinks.pipelineRunId}",
      copyAction: true,
    },
    {
      field: "hermesLinks.pipelineStepId",
      label: "Pipeline step",
      linkTemplate: "/dashboard/pipelines/steps/{hermesLinks.pipelineStepId}",
      copyAction: true,
    },
    {
      field: "hermesLinks.contentGenerationRunId",
      label: "Content-generation run",
      linkTemplate:
        "/dashboard/{integrationId}/content-generation-runs/{hermesLinks.contentGenerationRunId}",
      copyAction: true,
    },
  ],
} satisfies DetailBlock;

/** Hermes `table-v1` manifest for the read-only newsletters list + detail. */
export const newslettersDashboardPage = {
  id: newslettersHermesPathSegment,
  label: "Newsletters",
  description:
    "Newsletters generated by the content-generation agent and sent by the delivery agent (read-only).",
  pathSegment: newslettersHermesPathSegment,
  template: "table-v1" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(newslettersHermesPathSegment),
  order: 60,
  columns: columnsFor<ListItem>()([
    { key: "tickerSymbol", label: "Ticker", type: "text" },
    { key: "subject", label: "Subject", type: "text" },
    { key: "createdAt", label: "Created", type: "date-time" },
    { key: "deliveryDelivered", label: "Delivery", type: "text" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["subject"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["createdAt", "subject"]),
  defaultSort: { sortBy: "createdAt", sortDir: "desc" },
  listFilters: ["tickerId", "createdAt"],
  actions: { create: false, update: false, delete: false, view: true },
  detailBlocks: [
    newslettersMetadataBlock,
    newslettersBodyBlock,
    newslettersRecipientsBlock,
    newslettersSelectedSourcesBlock,
    newslettersSearchQueriesBlock,
    newslettersCitationsBlock,
    newslettersEmailPreviewBlock,
    newslettersHermesLinksBlock,
  ],
  customActions: newslettersCustomActionsForManifest,
} satisfies DashboardPageInput;
