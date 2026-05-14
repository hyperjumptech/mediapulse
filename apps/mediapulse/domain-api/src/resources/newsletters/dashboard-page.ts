import type { DashboardPageInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const newslettersHermesPathSegment = "newsletters" as const;

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
    { field: "subject", label: "Subject", copyAction: true },
    { field: "tickerSymbol", label: "Ticker" },
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
    "Generated newsletters with delivery counts: who got it, how many, and which ticker.",
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
  actions: { create: false, update: false, delete: false, view: true },
  detailBlocks: [newslettersMetadataBlock, newslettersHermesLinksBlock],
} satisfies DashboardPageInput;
