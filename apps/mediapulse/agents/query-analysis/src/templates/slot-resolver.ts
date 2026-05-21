import type { GetQueryAnalysisResponse } from "@workspace/agent-data-api-contract";

/** Clock dependency for time-anchored template slots. */
export type SlotResolverClock = () => Date;

/** Slot values available to deterministic template packs. */
export type ResolvedTemplateSlots = {
  symbol: string;
  name: string;
  topEntity?: string;
  recentTheme?: string;
  currentQuarter: string;
  currentYear: string;
  currentMonth: string;
};

const TEMPLATE_SLOT_PATTERN = /\{([a-zA-Z]+)\}/g;

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
 * Resolves slot values from query-analysis context and an injectable clock.
 *
 * @param context - GET /query-analysis response.
 * @param clock - Returns the reference instant (default: now).
 * @returns Slot map; optional slots are `undefined` when context lacks data.
 */
export const resolveSlots = (
  context: GetQueryAnalysisResponse,
  clock: SlotResolverClock = () => new Date(),
): ResolvedTemplateSlots => {
  const now = clock();
  const topEntity =
    context.topEntities.length > 0
      ? [...context.topEntities].sort(
          (a, b) => b.relevanceWeight - a.relevanceWeight,
        )[0]?.canonicalName
      : undefined;

  return {
    symbol: context.ticker.symbol,
    name: context.ticker.name,
    topEntity,
    recentTheme: context.recentThemes[0]?.theme,
    currentQuarter: formatCurrentQuarter(now),
    currentYear: String(now.getFullYear()),
    currentMonth: formatCurrentMonth(now),
  };
};

/**
 * Renders a template when every referenced slot resolves to a non-empty string.
 *
 * @param pattern - Template text with `{slot}` placeholders.
 * @param slots - Resolved slot values from {@link resolveSlots}.
 * @returns Rendered query text, or `null` when a required slot is missing.
 */
export const resolveTemplatePattern = (
  pattern: string,
  slots: ResolvedTemplateSlots,
): string | null => {
  const required = extractSlotsFromPattern(pattern);
  const slotRecord: Record<string, string | undefined> = {
    symbol: slots.symbol,
    name: slots.name,
    topEntity: slots.topEntity,
    recentTheme: slots.recentTheme,
    currentQuarter: slots.currentQuarter,
    currentYear: slots.currentYear,
    currentMonth: slots.currentMonth,
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
