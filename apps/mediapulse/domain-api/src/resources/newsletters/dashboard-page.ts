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
 * `panel` grouping the source-collection stage into one card: KPI cards (when the runs ran, the
 * search credits they spent with a per-provider breakdown, and the collected/dropped counts) above a
 * Collected/Dropped tab pair. Collected lists each cited source with its versioned agent and query;
 * Dropped lists the URLs those same runs dropped or failed, with the reason. All figures come from
 * this newsletter's exact citation join traced to the collection runs behind those sources.
 */
const newslettersSourceStageBlock = {
  type: "panel",
  label: "Source Collection Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        {
          label: "Generated Date",
          field: "sourceCollection.generatedAtLabel",
        },
        {
          label: "Search Credits",
          field: "sourceCollection.creditsTotalLabel",
          tooltipField: "sourceCollection.creditsBreakdownLabel",
        },
        {
          label: "Total Collected",
          field: "sourceCollection.collectedTotalLabel",
        },
        {
          label: "Total Dropped",
          field: "sourceCollection.droppedTotalLabel",
        },
      ],
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "Collected",
          block: {
            type: "subTable",
            field: "sourceCollection.sources",
            rowLimitOptions: [5, 10],
            rowLimitDefaultAll: true,
            emptyState: "No sources cited by this newsletter.",
            columns: [
              {
                field: "title",
                label: "Article",
                type: "text",
                truncate: 80,
                linkTemplate: "{url}",
                linkExternal: true,
                descriptionField: "agentLine",
              },
              {
                field: "queryText",
                label: "Query",
                type: "text",
                truncate: 60,
              },
            ],
          },
        },
        {
          label: "Dropped",
          block: {
            type: "subTable",
            field: "sourceCollection.dropped",
            rowLimitOptions: [10, 25],
            emptyState:
              "No dropped URLs recorded for the runs behind this newsletter.",
            columns: [
              {
                field: "url",
                label: "Article URL",
                type: "text",
                truncate: 80,
                noWrap: true,
                linkTemplate: "{url}",
                linkExternal: true,
                descriptionField: "agentLine",
              },
              {
                field: "reason",
                label: "Reason",
                type: "text",
                truncate: 100,
                descriptionField: "reasonDetail",
              },
            ],
          },
        },
      ],
    },
  ],
} satisfies DetailBlock;

/**
 * `panel` grouping the source-analysis stage into one card: KPI cards (when the analysis runs ran,
 * the LLM model, the token spend with a per-input/output breakdown, and the assigned/rejected counts)
 * above an Assigned/Rejected tab pair. Assigned lists each cited source with its analysis section,
 * fit score, and reason; Rejected lists the sources those same runs rejected for this ticker. All
 * figures come from this newsletter's exact citation join traced to the article-analysis runs behind
 * those sources.
 */
const newslettersSourceAnalysisStageBlock = {
  type: "panel",
  label: "Source Analysis Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Agent", field: "sourceAnalysis.agentLabel" },
        {
          label: "Generated Date",
          field: "sourceAnalysis.generatedAtLabel",
        },
        { label: "LLM Model", field: "sourceAnalysis.modelLabel" },
        {
          label: "LLM Tokens",
          field: "sourceAnalysis.tokensTotalLabel",
          tooltipField: "sourceAnalysis.tokensBreakdownLabel",
        },
      ],
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "Assigned",
          countField: "sourceAnalysis.assigned",
          block: {
            type: "subTable",
            field: "sourceAnalysis.assigned",
            rowLimitOptions: [5, 10],
            rowLimitDefaultAll: true,
            emptyState: "No analysed sources cited by this newsletter.",
            columns: [
              {
                field: "title",
                label: "Article",
                type: "text",
                truncate: 80,
                minWidth: 320,
                linkTemplate: "{url}",
                linkExternal: true,
                descriptionField: "classifiedLabel",
              },
              {
                field: "scoreLabel",
                label: "Score",
                type: "badge",
                noWrap: true,
                badgeVariantField: "scoreVariant",
              },
              { field: "reason", label: "Reason", type: "text" },
            ],
          },
        },
        {
          label: "Rejected",
          countField: "sourceAnalysis.rejected",
          block: {
            type: "subTable",
            field: "sourceAnalysis.rejected",
            rowLimitOptions: [10, 25],
            emptyState:
              "No rejected sources recorded for the runs behind this newsletter.",
            columns: [
              {
                field: "title",
                label: "Article",
                type: "text",
                truncate: 80,
                linkTemplate: "{url}",
                linkExternal: true,
              },
              { field: "reason", label: "Reason", type: "text" },
            ],
          },
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
    newslettersSourceAnalysisStageBlock,
    newslettersEmailPreviewBlock,
    newslettersHermesLinksBlock,
  ],
  customActions: newslettersCustomActionsForManifest,
} satisfies DashboardViewInput;
