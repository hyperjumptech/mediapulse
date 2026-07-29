import { z } from "zod";

/**
 * Allowed badge variants for detail-block section headers.
 * Section-header rules can attach one of these variants alongside a label.
 */
export const detailBlockBadgeVariantSchema = z.enum([
  "muted",
  "outline",
  "success",
  "warning",
  "destructive",
]);

/**
 * Section-header rule declaration. When `when` evaluates truthy against the detail
 * response, the renderer shows the `badge` variant with the given `label` text.
 *
 * The expression language is intentionally tiny and documented (see
 * `evaluateDetailBlockRule`). Comparisons, equality, presence, length, and
 * hoursBetween are supported; nothing else is accepted at parse time.
 */
export const detailBlockSectionRuleSchema = z.object({
  when: z.string().min(1),
  badge: detailBlockBadgeVariantSchema,
  label: z.string().min(1),
});

/** Common-to-all-blocks fields. */
const detailBlockCommonShape = {
  /** Optional caption shown above the block. */
  label: z.string().min(1).optional(),
  /** Optional section-header rule. */
  sectionRule: detailBlockSectionRuleSchema.optional(),
} as const;

/**
 * `keyValue` block — a list of label/value rows pulled from a response object.
 * Each row reads a `field` (dotted path) from the response. Optional `linkTemplate`
 * turns the value into a link (template values are filled from the response).
 */
export const detailBlockKeyValueRowSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  /**
   * Optional URL template (e.g. `/dashboard/{integrationId}/tickers/{tickerId}`).
   * Missing template variables fall back to plain text.
   */
  linkTemplate: z.string().min(1).optional(),
  /** When true, renders a copy-to-clipboard button next to the value. */
  copyAction: z.boolean().optional(),
  /** Optional formatter; "tokens" formats `prompt + completion = total`. */
  format: z.enum(["text", "date-time", "tokens", "number"]).optional(),
  /**
   * For `format: "tokens"` only — names of the three numeric fields to format as
   * `prompt + completion = total`. Each name is a dotted path on the response.
   */
  tokenFields: z
    .object({
      prompt: z.string().min(1),
      completion: z.string().min(1),
      total: z.string().min(1),
    })
    .optional(),
});

export const detailBlockKeyValueSchema = z.object({
  type: z.literal("keyValue"),
  ...detailBlockCommonShape,
  rows: z.array(detailBlockKeyValueRowSchema).min(1),
});

/**
 * `markdown` block — renders a string field as markdown.
 * Honors `clampChars` for a "show full" expander when the body exceeds
 * `clampThreshold` chars (default: 2 * clampChars).
 */
export const detailBlockMarkdownSchema = z.object({
  type: z.literal("markdown"),
  ...detailBlockCommonShape,
  /** Dotted field path on the detail response. */
  field: z.string().min(1),
  /** Optional clamp window in characters; renders a "show full" expander. */
  clampChars: z.number().int().positive().optional(),
  /**
   * Threshold (in characters) above which clamping applies. Defaults to
   * `clampChars * 2` when `clampChars` is set. Ignored when `clampChars` is absent.
   */
  clampThreshold: z.number().int().positive().optional(),
  /** When true, render a copy-to-clipboard button that writes the raw markdown. */
  copyAction: z.boolean().optional(),
});

/**
 * `htmlPreview` block — sandboxed iframe rendering an HTML string from the
 * response. Sandbox is exactly `allow-popups`; no scripts, no same-origin.
 */
export const detailBlockHtmlPreviewSchema = z.object({
  type: z.literal("htmlPreview"),
  ...detailBlockCommonShape,
  field: z.string().min(1),
});

/**
 * Item shape for a `type: "list"` column. Each entry of the bound array renders as its own stacked
 * value, using the same overline / value / description layout a single cell already supports.
 */
export const detailBlockSubTableListItemSchema = z.object({
  /** Dotted field path on each array entry, holding the entry's primary value. */
  field: z.string().min(1),
  /**
   * Path to a boolean on the entry. When truthy, the entry's primary value renders in bold so the
   * standout entry is findable without reading the list.
   */
  emphasisField: z.string().min(1).optional(),
  /**
   * When true, each entry's `descriptionField` is hidden behind a native disclosure toggle whose
   * summary is the primary value, so a long list stays scannable until a reader opens one entry.
   * Ignored when there is no `descriptionField`.
   */
  collapsible: z.boolean().optional(),
  /** Path to a badge variant name on the entry, used to color its primary value. */
  colorField: z.string().min(1).optional(),
  /** Path to a muted line rendered beneath the entry's primary value. */
  descriptionField: z.string().min(1).optional(),
  /** Path to a muted eyebrow rendered above the entry's primary value. */
  overlineField: z.string().min(1).optional(),
  /** Truncate the entry's primary value to N characters. */
  truncate: z.number().int().positive().optional(),
  /** Render the entry's primary value in muted foreground. */
  muted: z.boolean().optional(),
});

/** Column for a `subTable` block. */
export const detailBlockSubTableColumnSchema = z
  .object({
    /** Dotted field path on each row of the bound array. */
    field: z.string().min(1),
    label: z.string().min(1),
    type: z
      .enum(["text", "date-time", "number", "badge", "list"])
      .default("text"),
    /**
     * Optional URL template. When set, the column renders as a link.
     * Variables come from the row (and from a `row` namespace), e.g.
     * `/dashboard/{integrationId}/data-sources/{id}` or
     * `/dashboard/{integrationId}/search-queries?tickerId={tickerId}`.
     */
    linkTemplate: z.string().min(1).optional(),
    /** Open external links in a new tab with `rel="noopener noreferrer"`. */
    linkExternal: z.boolean().optional(),
    /** Truncate text to N characters; full value shown on hover/focus. */
    truncate: z.number().int().positive().optional(),
    /** Keep the cell value on a single line (no wrapping); the table scrolls horizontally instead. */
    noWrap: z.boolean().optional(),
    /** Minimum column width in pixels, so a short column keeps some breathing room in a wide table. */
    minWidth: z.number().int().positive().optional(),
    /** When true, render the (non-link) cell value in muted foreground, for supporting/secondary text. */
    muted: z.boolean().optional(),
    /**
     * Path to a field whose value is a badge variant name (`success` / `warning` / `destructive` /
     * `muted`), used to color the (non-link) cell text — e.g. a banded score shown as colored text
     * rather than a badge.
     */
    colorField: z.string().min(1).optional(),
    /**
     * Optional secondary field path rendered as a muted line beneath the cell value, so one column can
     * carry a primary value with a subtitle (e.g. a query with its intent below). Non-badge columns only.
     */
    descriptionField: z.string().min(1).optional(),
    /**
     * When set with `descriptionField`, renders the description as a link built from this URL template
     * (resolved against the row), so the subtitle can be a clickable title. Uses `linkExternal`.
     */
    descriptionLinkTemplate: z.string().min(1).optional(),
    /** When true, render a copy-to-clipboard button for the cell value. */
    copyAction: z.boolean().optional(),
    /**
     * For `type: "badge"` only — maps the cell value to a badge variant
     * (`success` / `warning` / `destructive` / `muted` / `outline`).
     */
    badgeVariants: z.record(detailBlockBadgeVariantSchema).optional(),
    /**
     * For `type: "badge"` only — path to a field whose value is the badge variant name directly. Use
     * when the variant is computed server-side (e.g. a score band) rather than mapped from the cell
     * value. Takes precedence over `badgeVariants`.
     */
    badgeVariantField: z.string().min(1).optional(),
    /**
     * Optional `inconsistent` marker field. When the row's value at that path is
     * truthy, the badge cell shows a `!` adornment with a tooltip.
     */
    inconsistentField: z.string().min(1).optional(),
    /**
     * Optional secondary field path rendered as a muted line above the cell value, so one column can
     * carry a small overline/eyebrow atop a prominent value (e.g. a section label above the title).
     * Non-badge columns only.
     */
    overlineField: z.string().min(1).optional(),
    /**
     * For `type: "list"` only — how to render each entry of the array at `field`. Use when one cell
     * carries several stacked values rather than a single one (e.g. a per-section score list).
     */
    listItem: detailBlockSubTableListItemSchema.optional(),
    /**
     * Path to a row-level value rendered as a heading band above the cell's own value, so a
     * single-column table reads as a titled block rather than a grid of cells. When set, the
     * column's `linkTemplate` and `linkExternal` link the heading rather than the value.
     */
    headingField: z.string().min(1).optional(),
    /**
     * For `type: "list"` only — how many columns the entries flow across on wider viewports.
     * Defaults to a single stacked column.
     */
    listColumns: z.number().int().min(1).max(4).optional(),
  })
  .superRefine((column, ctx) => {
    if (column.type === "list" && column.listItem === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["listItem"],
        message: 'listItem is required when type is "list"',
      });
    }
  });

export const detailBlockSubTableSchema = z.object({
  type: z.literal("subTable"),
  ...detailBlockCommonShape,
  /** Dotted field path on the response (must resolve to an array). */
  field: z.string().min(1),
  columns: z.array(detailBlockSubTableColumnSchema).min(1),
  /**
   * When true, the header row is not rendered. Useful for a single rich column where the column
   * label would just be noise (e.g. a query list where each row already reads as a query).
   */
  hideHeader: z.boolean().optional(),
  /**
   * Optional boolean field path marking a row as a full-width section header — rendered as a
   * spanning heading (the first column's value) that groups the rows beneath it, rather than a
   * normal data row. Use for a single-column list grouped under section headings.
   */
  sectionHeaderField: z.string().min(1).optional(),
  /** Empty-state copy when the array is empty. */
  emptyState: z.string().min(1).optional(),
  /**
   * Optional caption template (e.g. `Citations ({citations.length} unique)`).
   * Field references resolve against the full detail response.
   */
  captionTemplate: z.string().min(1).optional(),
  /**
   * When set, the renderer paginates the rows client-side at this page size
   * and shows prev/next controls plus a "Showing X–Y of Z" range label.
   * Caption template and section-rule still see the full unsliced response,
   * so aggregate badges (e.g. "partial delivery") keep firing across pages.
   */
  pageSize: z.number().int().positive().optional(),
  /**
   * When set, a row-count selector (these options plus "All") renders at the right of the section
   * header and limits the visible rows client-side. The first option is the default.
   */
  rowLimitOptions: z.array(z.number().int().positive()).min(1).optional(),
  /**
   * When true (and `rowLimitOptions` is set), the selector starts on "All" instead of the first
   * option, so the table shows every row until the reader narrows it.
   */
  rowLimitDefaultAll: z.boolean().optional(),
});

/**
 * One KPI card in a `statCards` block: a label, a primary value, and an optional tooltip field whose
 * value is revealed on hovering a help icon beside the label.
 */
export const detailBlockStatCardSchema = z.object({
  label: z.string().min(1),
  field: z.string().min(1),
  tooltipField: z.string().min(1).optional(),
  /**
   * Path to a field whose value is a badge variant name (`success` / `warning` / `destructive` /
   * `muted`), used to color the card's value — e.g. a delivery outcome.
   */
  colorField: z.string().min(1).optional(),
});

/**
 * `statCards` block — a responsive row of KPI cards, each with a label, a prominent value, and an
 * optional muted sub-line. Reads better than a key-value list for a few headline metrics.
 */
export const detailBlockStatCardsSchema = z.object({
  type: z.literal("statCards"),
  ...detailBlockCommonShape,
  cards: z.array(detailBlockStatCardSchema).min(1),
});

/**
 * Non-tabs leaf block kinds. Tabs may only contain these block types, which
 * keeps the discriminated union flat and prevents recursive nesting.
 */
export const detailBlockLeafSchema = z.discriminatedUnion("type", [
  detailBlockKeyValueSchema,
  detailBlockMarkdownSchema,
  detailBlockHtmlPreviewSchema,
  detailBlockSubTableSchema,
]);

export const detailBlockTabBadgeSchema = z.object({
  label: z.string().min(1),
  variant: detailBlockBadgeVariantSchema.default("outline"),
});

/** One tab inside a `tabs` block — a label plus a leaf block to render. */
export const detailBlockTabSchema = z.object({
  label: z.string().min(1),
  /**
   * Optional path to a value shown as a count beside the tab label. An array resolves to its
   * length; a number renders as-is. Absent or unresolved values render no count.
   */
  countField: z.string().optional(),
  badge: detailBlockTabBadgeSchema.optional(),
  /**
   * Optional rule (same language as `sectionRule.when`) deciding whether this tab renders at
   * all. Absent means always visible; a rule that fails to parse or evaluate leaves the tab
   * visible, so a bad expression never silently hides content.
   */
  visibleWhen: z.string().min(1).optional(),
  block: detailBlockLeafSchema,
});

/**
 * `tabs` block — groups multiple leaf blocks under a single tabbed section so
 * related views (e.g. a markdown body and its email preview) share screen real
 * estate. Tabs cannot nest tabs; each tab content must be a leaf block.
 */
export const detailBlockTabsSchema = z.object({
  type: z.literal("tabs"),
  ...detailBlockCommonShape,
  tabs: z.array(detailBlockTabSchema).min(1),
});

/** Block kinds a `panel` may contain — leaf blocks, stat cards, and tabs; no further nesting. */
export const detailBlockPanelChildSchema = z.discriminatedUnion("type", [
  detailBlockKeyValueSchema,
  detailBlockMarkdownSchema,
  detailBlockHtmlPreviewSchema,
  detailBlockSubTableSchema,
  detailBlockStatCardsSchema,
  detailBlockTabsSchema,
]);

/**
 * `panel` block — groups several child blocks inside one bordered card under a shared heading, so a
 * multi-part section (e.g. stage KPI cards plus a results table) reads as a single unit.
 */
export const detailBlockPanelSchema = z.object({
  type: z.literal("panel"),
  ...detailBlockCommonShape,
  blocks: z.array(detailBlockPanelChildSchema).min(1),
});

/**
 * Discriminated union of supported detail-block kinds for `table-v1` resources.
 * Renderers MUST throw when asked to render an unknown block type.
 */
export const detailBlockSchema = z.discriminatedUnion("type", [
  detailBlockKeyValueSchema,
  detailBlockMarkdownSchema,
  detailBlockHtmlPreviewSchema,
  detailBlockSubTableSchema,
  detailBlockStatCardsSchema,
  detailBlockPanelSchema,
  detailBlockTabsSchema,
]);

export type DetailBlock = z.infer<typeof detailBlockSchema>;
export type DetailBlockLeaf = z.infer<typeof detailBlockLeafSchema>;
export type DetailBlockKeyValue = z.infer<typeof detailBlockKeyValueSchema>;
export type DetailBlockKeyValueRow = z.infer<
  typeof detailBlockKeyValueRowSchema
>;
export type DetailBlockMarkdown = z.infer<typeof detailBlockMarkdownSchema>;
export type DetailBlockHtmlPreview = z.infer<
  typeof detailBlockHtmlPreviewSchema
>;
export type DetailBlockSubTable = z.infer<typeof detailBlockSubTableSchema>;
export type DetailBlockStatCards = z.infer<typeof detailBlockStatCardsSchema>;
export type DetailBlockStatCard = z.infer<typeof detailBlockStatCardSchema>;
export type DetailBlockPanel = z.infer<typeof detailBlockPanelSchema>;
export type DetailBlockPanelChild = z.infer<typeof detailBlockPanelChildSchema>;
export type DetailBlockSubTableColumn = z.infer<
  typeof detailBlockSubTableColumnSchema
>;
export type DetailBlockSubTableListItem = z.infer<
  typeof detailBlockSubTableListItemSchema
>;
export type DetailBlockTabs = z.infer<typeof detailBlockTabsSchema>;
export type DetailBlockTab = z.infer<typeof detailBlockTabSchema>;
export type DetailBlockTabBadge = z.infer<typeof detailBlockTabBadgeSchema>;
export type DetailBlockBadgeVariant = z.infer<
  typeof detailBlockBadgeVariantSchema
>;
export type DetailBlockSectionRule = z.infer<
  typeof detailBlockSectionRuleSchema
>;
