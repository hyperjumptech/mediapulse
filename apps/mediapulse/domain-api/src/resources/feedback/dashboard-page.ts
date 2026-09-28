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
  type ManifestColumnBadgeTones,
} from "../../hermes-dashboard/templates/table-v1/manifest-field-helpers";
import type { ListItem } from "./list-mapper";

export const feedbackHermesPathSegment = "feedback" as const;

export const feedbackSentimentBadgeTones = {
  Positive: "success",
  Negative: "failed",
  Mixed: "warning",
  Neutral: "neutral",
  "—": "muted",
} as const satisfies ManifestColumnBadgeTones;

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

const feedbackBodyBlock = {
  type: "markdown",
  label: "Reply body",
  field: "rawBody",
  clampChars: 4000,
  clampThreshold: 10000,
  copyAction: true,
} satisfies DetailBlock;

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
    { key: "subject", label: "Subject", type: "text", mobile: "subtitle" },
    {
      key: "sentiment",
      label: "Sentiment",
      type: "text",
      format: "badge",
      badgeTones: feedbackSentimentBadgeTones,
      mobile: "badge",
    },
    { key: "category", label: "Category", type: "text" },
    {
      key: "receivedAt",
      label: "Received",
      type: "date-time",
      format: "date-time",
    },
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
