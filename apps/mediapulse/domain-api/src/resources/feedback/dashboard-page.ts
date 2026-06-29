/**
 * Hermes `resource-table` manifest slice for newsletter feedback and the exported `*HermesPathSegment` for routing.
 */

import type { DashboardViewInput, DetailBlock } from "@hermes/domain-contract";
import { hermesDashboardManifestApiPrefix } from "../../hermes-dashboard/hermes-dashboard-path-helpers";
import {
  feedbackCategorySelectListFilter,
  feedbackReceivedAtDateRangeListFilter,
  feedbackSentimentSelectListFilter,
} from "../../hermes-dashboard/templates/table-v1/list-filter-definitions";
import {
  columnsFor,
  rowFieldKeysFor,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

/** URL path segment for this resource under `/v1/hermes-dashboard/`. */
export const feedbackHermesPathSegment = "feedback" as const;

/**
 * `keyValue` block describing the reply metadata: sender, classification, and
 * link rows back to the correlated newsletter and Mediapulse user. Missing
 * template variables (e.g. an uncorrelated reply) fall back to plain text.
 */
const feedbackMetadataBlock = {
  type: "keyValue",
  label: "Metadata",
  rows: [
    { field: "id", label: "Feedback id", copyAction: true },
    { field: "senderEmail", label: "From", copyAction: true },
    { field: "subject", label: "Subject" },
    { field: "receivedAt", label: "Received", format: "date-time" },
    { field: "sentiment", label: "Sentiment" },
    { field: "category", label: "Category" },
    { field: "classifierModel", label: "Classifier model" },
    { field: "classifiedAt", label: "Classified at", format: "date-time" },
    {
      field: "newsletterId",
      label: "Newsletter",
      linkTemplate: "/dashboard/{integrationId}/newsletters/{newsletterId}",
      copyAction: true,
    },
    {
      field: "userId",
      label: "Mediapulse user",
      linkTemplate: "/dashboard/{integrationId}/mediapulse-users/{userId}",
      copyAction: true,
    },
  ],
} satisfies DetailBlock;

/**
 * `markdown` block bound to the raw reply body. Long bodies clamp at 4,000
 * characters with a "show full" expander once they exceed 10,000 characters.
 */
const feedbackBodyBlock = {
  type: "markdown",
  label: "Reply body",
  field: "rawBody",
  clampChars: 4000,
  clampThreshold: 10000,
  copyAction: true,
} satisfies DetailBlock;

/** Hermes `resource-table` manifest page for newsletter feedback (read-only list + detail). */
export const feedbackDashboardPage = {
  id: feedbackHermesPathSegment,
  label: "Feedback",
  description:
    "Replies to delivered newsletters, captured and classified by sentiment and category (read-only).",
  pathSegment: feedbackHermesPathSegment,
  kind: "resource-table" as const,
  placement: "sidebar" as const,
  apiPrefix: hermesDashboardManifestApiPrefix(feedbackHermesPathSegment),
  order: 65,
  columns: columnsFor<ListItem>()([
    { key: "senderEmail", label: "From", type: "text" },
    { key: "subject", label: "Subject", type: "text" },
    { key: "sentiment", label: "Sentiment", type: "text" },
    { key: "category", label: "Category", type: "text" },
    { key: "receivedAt", label: "Received", type: "date-time" },
  ]),
  searchableFields: rowFieldKeysFor<ListItem>()(["senderEmail", "subject"]),
  sortableFields: rowFieldKeysFor<ListItem>()(["receivedAt", "senderEmail"]),
  defaultSort: { sortBy: "receivedAt", sortDir: "desc" },
  listFilters: [
    feedbackSentimentSelectListFilter,
    feedbackCategorySelectListFilter,
    feedbackReceivedAtDateRangeListFilter,
  ],
  actions: { create: false, update: false, delete: false, view: true },
  detailBlocks: [feedbackMetadataBlock, feedbackBodyBlock],
} satisfies DashboardViewInput;
