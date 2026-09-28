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

export const newslettersHermesPathSegment = "newsletters" as const;

export const NEWSLETTER_STALE_SET_HOURS = 24 as const;

const newslettersDeliveryStageBlock = {
  type: "panel",
  label: "Delivery Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Agent", field: "delivery.agentLabel" },
        {
          label: "Delivered Date",
          field: "delivery.deliveredAt",
          format: "date-time",
        },
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

const newslettersQueryStageBlock = {
  type: "panel",
  label: "Query Generation Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        { label: "Agent", field: "activeQuerySet.agentLabel" },
        {
          label: "Generated Date",
          field: "activeQuerySet.generatedAt",
          format: "date-time",
        },
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

const newslettersSourceStageBlock = {
  type: "panel",
  label: "Source Collection Stage",
  blocks: [
    {
      type: "statCards",
      cards: [
        {
          label: "Generated Date",
          field: "sourceCollection.generatedAt",
          format: "date-time",
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
          field: "sourceAnalysis.generatedAt",
          format: "date-time",
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
            hideHeader: true,
            emptyState: "No analysed sources cited by this newsletter.",
            columns: [
              {
                field: "sectionScores",
                label: "Article",
                type: "list",
                headingField: "title",
                linkTemplate: "{url}",
                linkExternal: true,
                listItem: {
                  field: "scoreLine",
                  colorField: "scoreVariant",
                  emphasisField: "isSelected",
                  descriptionField: "reason",
                  collapsible: true,
                },
              },
              {
                field: "publisher",
                label: "Publisher",
                type: "text",
                muted: true,
              },
              {
                field: "publisherAuthorityLabel",
                label: "Authority",
                type: "text",
                muted: true,
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
            hideHeader: true,
            emptyState:
              "No rejected sources recorded for the runs behind this newsletter.",
            columns: [
              {
                field: "reason",
                label: "Article",
                type: "text",
                muted: true,
                headingField: "title",
                linkTemplate: "{url}",
                linkExternal: true,
              },
            ],
          },
        },
      ],
    },
  ],
} satisfies DetailBlock;

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
          field: "contentGeneration.generatedAt",
          format: "date-time",
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
          linkTemplate: "{url}",
          linkExternal: true,
          bulletField: "isPoint",
        },
      ],
    },
  ],
} satisfies DetailBlock;

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
    { key: "subject", label: "Subject", type: "text", mobile: "subtitle" },
    {
      key: "deliveryDelivered",
      label: "Delivered",
      type: "text",
      format: "number",
    },
    {
      key: "createdAt",
      label: "Created",
      type: "date-time",
      format: "date-time",
    },
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
