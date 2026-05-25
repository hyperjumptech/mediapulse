import type {
  GetQueryAnalysisResponse,
  QueryAnalysisIntent,
} from "@workspace/agent-data-api-contract";

import { daysUntilEarnings } from "../temporal/event-bias";
import { resolveEntityDisplayName } from "../i18n/entity-aliases";
import { resolveRelationVerb } from "./relation-verbs";

/** Clock dependency for time-anchored template slots. */
export type SlotResolverClock = () => Date;

/** Slot values available to deterministic template packs. */
export type ResolvedTemplateSlots = {
  symbol: string;
  name: string;
  topEntity?: string;
  recentTheme?: string;
  sector?: string;
  industry?: string;
  currentQuarter: string;
  currentYear: string;
  currentMonth: string;
  daysToEarnings?: string;
  lastEventType?: string;
};

/** Per-relation slot values merged with {@link ResolvedTemplateSlots}. */
export type KgRelationSlots = {
  fromEntity: string;
  toEntity: string;
  relationVerb: string;
};

/** One KG relation row prioritized for template expansion. */
export type OrderedKgRelationRow = KgRelationSlots & {
  source: "delta" | "neighborhood";
  change?: "added" | "removed" | "updated";
};

/** KG relation template applied per relation row during expansion. */
export type KgRelationTemplate = {
  template: string;
  intent: QueryAnalysisIntent;
  sources: Array<"delta" | "neighborhood">;
  whenChange?: "added" | "removed" | "updated";
};

const TEMPLATE_SLOT_PATTERN = /\{([a-zA-Z]+)\}/g;

type TickerMetadataRecord = Record<string, unknown>;

/**
 * Reads the first non-empty string from ticker metadata for the given keys.
 *
 * @param metadata - Ticker JSON metadata from GET /query-analysis.
 * @param keys - Candidate field names in priority order.
 * @returns Trimmed string value, or `undefined` when absent.
 */
const pickMetadataString = (
  metadata: unknown,
  keys: string[],
): string | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const record = metadata as TickerMetadataRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

/**
 * Extracts sector and industry labels from ticker metadata (IDX or admin keys).
 *
 * @param metadata - Ticker JSON metadata from GET /query-analysis.
 * @returns Sector/industry strings when present.
 */
export const extractTemplateSectorIndustry = (
  metadata: unknown,
): { sector?: string; industry?: string } => ({
  sector: pickMetadataString(metadata, ["Sektor", "sector"]),
  industry: pickMetadataString(metadata, ["Industri", "industry"]),
});

/**
 * Extracts unique slot names referenced in a template string (e.g. `{name}` → `name`).
 *
 * @param pattern - Template text with `{slot}` placeholders.
 * @returns Ordered unique slot names.
 */
export const extractSlotsFromPattern = (pattern: string): string[] => {
  const names = new Set<string>();
  for (const match of pattern.matchAll(TEMPLATE_SLOT_PATTERN)) {
    const slot = match[1];
    if (slot) {
      names.add(slot);
    }
  }
  return [...names];
};

/**
 * Formats the calendar quarter for a date (e.g. May 2026 → `Q2 2026`).
 *
 * @param date - Reference instant.
 * @returns Quarter label including year.
 */
export const formatCurrentQuarter = (date: Date): string => {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `Q${String(quarter)} ${String(date.getFullYear())}`;
};

/**
 * Formats the calendar month name for a date (e.g. May 2026 → `May`).
 *
 * @param date - Reference instant.
 * @returns English long month name.
 */
export const formatCurrentMonth = (date: Date): string =>
  date.toLocaleString("en-US", { month: "long" });

/**
 * Formats days-until-earnings for template slots when calendar data is present.
 *
 * @param context - GET /query-analysis response.
 * @param clock - Reference instant (default: now).
 * @returns Day count as a string, or `undefined` when earnings date is absent.
 */
export const formatDaysToEarnings = (
  context: GetQueryAnalysisResponse,
  clock: SlotResolverClock = () => new Date(),
): string | undefined => {
  const days = daysUntilEarnings(context, clock);
  return days === undefined ? undefined : String(days);
};

/**
 * Collects relation rows for KG template expansion: deltas first, then neighborhood.
 *
 * @param context - GET /query-analysis response.
 * @param cap - Maximum relation rows to include (`0` yields an empty list).
 * @returns Ordered relation rows with resolved verb phrases.
 */
export const collectOrderedKgRelationRows = (
  context: GetQueryAnalysisResponse,
  cap: number,
): OrderedKgRelationRow[] => {
  if (cap <= 0) {
    return [];
  }

  const rows: OrderedKgRelationRow[] = [];

  for (const delta of context.recentRelationDeltas ?? []) {
    if (rows.length >= cap) {
      break;
    }
    rows.push({
      source: "delta",
      change: delta.change,
      fromEntity: delta.fromEntity,
      toEntity: delta.toEntity,
      relationVerb: resolveRelationVerb(delta.relationType, delta.change),
    });
  }

  for (const edge of context.kgNeighborhood) {
    if (rows.length >= cap) {
      break;
    }
    rows.push({
      source: "neighborhood",
      fromEntity: edge.fromEntity,
      toEntity: edge.toEntity,
      relationVerb: resolveRelationVerb(edge.relationType),
    });
  }

  return rows;
};

/**
 * Selects the best KG relation template for a row (specific `whenChange` wins over generic).
 *
 * @param templates - KG relation templates from the active pack.
 * @param row - Ordered relation row with source and optional change.
 * @returns First matching template in pack order, or `undefined` when none apply.
 */
export const selectKgRelationTemplate = (
  templates: KgRelationTemplate[],
  row: OrderedKgRelationRow,
): KgRelationTemplate | undefined => {
  const matching = templates.filter(
    (template) =>
      template.sources.includes(row.source) &&
      (template.whenChange === undefined || template.whenChange === row.change),
  );
  if (matching.length === 0) {
    return undefined;
  }

  const sourceSpecific = matching.filter((template) => {
    if (row.source === "delta") {
      return (
        template.sources.includes("delta") &&
        !template.sources.includes("neighborhood")
      );
    }
    return (
      template.sources.includes("neighborhood") &&
      !template.sources.includes("delta")
    );
  });
  const pool = sourceSpecific.length > 0 ? sourceSpecific : matching;

  return pool.find((template) => template.whenChange !== undefined) ?? pool[0];
};

/**
 * Resolves slot values from query-analysis context and an injectable clock.
 *
 * @param context - GET /query-analysis response.
 * @param clock - Returns the reference instant (default: now).
 * @returns Slot map; optional slots are `undefined` when context lacks data.
 */
export const resolveSlots = (
  context: GetQueryAnalysisResponse,
  clock: SlotResolverClock = () => new Date(),
  language?: string,
): ResolvedTemplateSlots => {
  const now = clock();
  const companyName =
    language !== undefined
      ? resolveEntityDisplayName(
          context.ticker.symbol,
          context.ticker.name,
          language,
        )
      : context.ticker.name;
  const topEntity =
    context.topEntities.length > 0
      ? [...context.topEntities].sort(
          (a, b) => b.relevanceWeight - a.relevanceWeight,
        )[0]?.canonicalName
      : undefined;
  const { sector, industry } = extractTemplateSectorIndustry(
    context.ticker.metadata,
  );

  return {
    symbol: context.ticker.symbol,
    name: companyName,
    topEntity,
    recentTheme: context.recentThemes[0]?.theme,
    sector,
    industry,
    currentQuarter: formatCurrentQuarter(now),
    currentYear: String(now.getFullYear()),
    currentMonth: formatCurrentMonth(now),
    daysToEarnings: formatDaysToEarnings(context, clock),
    lastEventType: context.calendar.recentEventTypes[0],
  };
};

/**
 * Renders a template when every referenced slot resolves to a non-empty string.
 *
 * @param pattern - Template text with `{slot}` placeholders.
 * @param slots - Resolved slot values from {@link resolveSlots} plus optional KG slots.
 * @returns Rendered query text, or `null` when a required slot is missing.
 */
export const resolveTemplatePattern = (
  pattern: string,
  slots: ResolvedTemplateSlots,
  kgSlots?: KgRelationSlots,
): string | null => {
  const required = extractSlotsFromPattern(pattern);
  const slotRecord: Record<string, string | undefined> = {
    symbol: slots.symbol,
    name: slots.name,
    topEntity: slots.topEntity,
    recentTheme: slots.recentTheme,
    sector: slots.sector,
    industry: slots.industry,
    currentQuarter: slots.currentQuarter,
    currentYear: slots.currentYear,
    currentMonth: slots.currentMonth,
    daysToEarnings: slots.daysToEarnings,
    lastEventType: slots.lastEventType,
    fromEntity: kgSlots?.fromEntity,
    toEntity: kgSlots?.toEntity,
    relationVerb: kgSlots?.relationVerb,
  };

  for (const name of required) {
    const value = slotRecord[name];
    if (!value?.trim()) {
      return null;
    }
  }

  return pattern.replace(TEMPLATE_SLOT_PATTERN, (_match, key: string) => {
    const value = slotRecord[key];
    return value?.trim() ?? "";
  });
};

/**
 * Expands KG relation templates into one deterministic query per relation row.
 *
 * @param context - GET /query-analysis response.
 * @param templates - KG relation templates from the active pack.
 * @param baseSlots - Ticker-level slots from {@link resolveSlots}.
 * @param cap - Maximum KG-derived rows (`0` disables expansion).
 * @returns Rendered KG query candidates in delta-first order.
 */
export const expandKgRelationQueries = (
  context: GetQueryAnalysisResponse,
  templates: KgRelationTemplate[],
  baseSlots: ResolvedTemplateSlots,
  cap: number,
): Array<{ text: string; intent: QueryAnalysisIntent }> => {
  if (cap <= 0 || templates.length === 0) {
    return [];
  }

  const rows = collectOrderedKgRelationRows(context, cap);
  const candidates: Array<{ text: string; intent: QueryAnalysisIntent }> = [];

  for (const row of rows) {
    const template = selectKgRelationTemplate(templates, row);
    if (!template) {
      continue;
    }
    const text = resolveTemplatePattern(template.template, baseSlots, {
      fromEntity: row.fromEntity,
      toEntity: row.toEntity,
      relationVerb: row.relationVerb,
    });
    if (text) {
      candidates.push({ text, intent: template.intent });
    }
  }

  return candidates;
};
