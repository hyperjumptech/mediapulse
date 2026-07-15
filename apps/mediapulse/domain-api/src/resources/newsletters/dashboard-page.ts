import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  createdAtDateRangeListFilter,
  tickerIdSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import { newslettersCustomActionsForManifest } from "./custom-actions";
import type { ListItem } from "./list-mapper";

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
 * `subTable` block bound to `citedArticles` — the articles cited by this newsletter, read from the
 * `newsletter_citation` table and joined to the section, score, and reason article-analysis assigned
 * for this ticker plus the search query that surfaced each one. Gives a reviewer a straight line from
 * the shipped newsletter back to the query and reasoning behind every citation. Rows are grouped by
 * published section in newsletter order (server-sorted in `buildCitedArticles`). The Title links out
 * to the article and carries its published section as an overline.
 */
const newslettersCitedArticlesBlock = {
  type: "subTable",
  label: "Articles cited",
  field: "citedArticles",
  emptyState: "No citations recorded for this newsletter.",
  columns: [
    {
      field: "title",
      label: "Title",
      type: "text",
      truncate: 80,
      linkTemplate: "{url}",
      linkExternal: true,
      overlineField: "publishedSection",
    },
    { field: "sectionScore", label: "Score", type: "number" },
    { field: "queryText", label: "Query", type: "text", truncate: 60 },
    { field: "sectionReason", label: "Reason", type: "text", truncate: 120 },
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
 * `panel` grouping the query-analysis stage into one card: KPI cards (agent + version, when it ran,
 * the LLM model, and token spend from the set's columns and `strategySnapshot.llmUsage`) above a
 * results table snapshotting the queries in the active set, each with its intent beneath.
 */
const newslettersQueryStageBlock = {
  type: "panel",
  label: "Query Generation Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Agent", field: "activeQuerySet.agentLabel" },
        { label: "Generated Date", field: "activeQuerySet.generatedAtLabel" },
        { label: "LLM Model", field: "activeQuerySet.model" },
        {
          label: "LLM Tokens",
          field: "activeQuerySet.tokensTotalLabel",
          tooltipField: "activeQuerySet.tokensBreakdownLabel",
        },
      ],
    },
    {
      type: "subTable",
      label: "Results",
      field: "activeQuerySet.queries",
      hideHeader: true,
      rowLimitOptions: [5, 10],
      emptyState:
        "No active SearchQuerySet on this newsletter's generation date.",
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
          descriptionField: "intent",
        },
      ],
    },
  ],
} satisfies DetailBlock;

/**
 * `panel` grouping the source-collection stage into one card: KPI cards (total cited sources, the
 * data-collection vs page-collection split, and distinct publishers) above a results table listing
 * each cited source with its collector as an overline and its publisher and collected date beneath.
 * All figures come from this newsletter's exact citation join, so they reflect only the sources it
 * used rather than the ticker's wider collection funnel.
 */
const newslettersSourceStageBlock = {
  type: "panel",
  label: "Source Collection Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Sources", field: "sourceCollection.totalLabel" },
        {
          label: "Data Collection",
          field: "sourceCollection.dataCollectionLabel",
        },
        {
          label: "Page Collection",
          field: "sourceCollection.pageCollectionLabel",
        },
        { label: "Publishers", field: "sourceCollection.publishersLabel" },
      ],
    },
    {
      type: "subTable",
      label: "Results",
      field: "sourceCollection.sources",
      hideHeader: true,
      rowLimitOptions: [5, 10],
      emptyState: "No sources cited by this newsletter.",
      columns: [
        {
          field: "title",
          label: "Source",
          type: "text",
          truncate: 80,
          linkTemplate: "{url}",
          linkExternal: true,
          overlineField: "collectorLabel",
          descriptionField: "meta",
        },
      ],
    },
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
  kind: "resource-table" as const,
  placement: "sidebar" as const,
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
  listFilters: [tickerIdSelectListFilter, createdAtDateRangeListFilter],
  actions: { create: false, update: false, delete: false, view: true },
  detailBlocks: [
    newslettersMetadataBlock,
    newslettersRecipientsBlock,
    newslettersQueryStageBlock,
    newslettersSourceStageBlock,
    newslettersCitedArticlesBlock,
    newslettersEmailPreviewBlock,
    newslettersHermesLinksBlock,
  ],
  customActions: newslettersCustomActionsForManifest,
} satisfies DashboardViewInput;
