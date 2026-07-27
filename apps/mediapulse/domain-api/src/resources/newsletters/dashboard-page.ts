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
 * `panel` grouping the delivery stage into one card: KPI cards (the delivery agent and version, when
 * it ran, its outcome, and delivered-of-total) above Recipients and Email Preview tabs. Recipients
 * lists each subscriber's exact per-run outcome; each Email Preview tab renders the sent email in
 * one language. The `id` tab is present only when this newsletter has an Indonesian
 * `NewsletterTranslation`. All figures come from the exact `DeliveryRun` behind this newsletter.
 */
const newslettersDeliveryStageBlock = {
  type: "panel",
  label: "Delivery Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Agent", field: "delivery.agentLabel" },
        { label: "Delivered Date", field: "delivery.deliveredAtLabel" },
        {
          label: "Outcome",
          field: "delivery.outcomeLabel",
          colorField: "delivery.outcomeVariant",
        },
        { label: "Delivered", field: "delivery.deliveredLabel" },
      ],
    },
    {
      type: "tabs",
      tabs: [
        {
          label: "Recipients",
          countField: "recipients",
          block: {
            type: "subTable",
            field: "recipients",
            rowLimitOptions: [10, 25],
            emptyState: "No enabled subscribers for this ticker.",
            columns: [
              { field: "displayName", label: "Recipient", type: "text" },
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
            ],
          },
        },
        {
          label: "Email Preview",
          badge: { label: "en", variant: "outline" },
          block: {
            type: "htmlPreview",
            field: "emailPreviewHtml",
          },
        },
        {
          label: "Email Preview",
          badge: { label: "id", variant: "outline" },
          visibleWhen: "present(emailPreviewHtmlIndonesian)",
          block: {
            type: "htmlPreview",
            field: "emailPreviewHtmlIndonesian",
          },
        },
      ],
    },
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
              },
              {
                field: "scoreLine",
                label: "Score",
                type: "text",
                colorField: "scoreVariant",
                descriptionField: "reason",
              },
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
              { field: "reason", label: "Reason", type: "text", muted: true },
            ],
          },
        },
      ],
    },
  ],
} satisfies DetailBlock;

/**
 * `panel` grouping the content-generation stage into one card: KPI cards (the writing agent and
 * version, when it ran, the LLM model, and its token spend) above a Structure table. The table lists
 * each newsletter section the agent filled with the number of items it wrote and the citations that
 * landed in it, read from this newsletter and the exact content-generation run that produced it.
 */
const newslettersContentGenerationStageBlock = {
  type: "panel",
  label: "Content Generation Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Agent", field: "contentGeneration.agentLabel" },
        {
          label: "Generated Date",
          field: "contentGeneration.generatedAtLabel",
        },
        { label: "LLM Model", field: "contentGeneration.model" },
        {
          label: "LLM Tokens",
          field: "contentGeneration.tokensTotalLabel",
          tooltipField: "contentGeneration.tokensBreakdownLabel",
        },
      ],
    },
    {
      type: "subTable",
      label: "Results",
      field: "contentGeneration.rows",
      hideHeader: true,
      sectionHeaderField: "isSection",
      emptyState: "No sections recorded for this newsletter.",
      columns: [
        {
          field: "label",
          label: "Article",
          type: "text",
          muted: true,
          descriptionField: "title",
          descriptionLinkTemplate: "{url}",
          linkExternal: true,
        },
      ],
    },
  ],
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
  detailTitleField: "subject",
  listFilters: [tickerIdSelectListFilter, createdAtDateRangeListFilter],
  actions: { create: false, update: false, delete: false, view: true },
  detailBlocks: [
    newslettersQueryStageBlock,
    newslettersSourceStageBlock,
    newslettersSourceAnalysisStageBlock,
    newslettersContentGenerationStageBlock,
    newslettersDeliveryStageBlock,
    newslettersHermesLinksBlock,
  ],
  customActions: newslettersCustomActionsForManifest,
} satisfies DashboardViewInput;
