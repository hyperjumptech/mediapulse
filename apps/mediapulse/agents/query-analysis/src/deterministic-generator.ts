/**
 * Deterministic (template-based) query generator.
 *
 * For the same ticker context and config the output is fully predictable and
 * reproducible — no model calls, no I/O.
 */

export type QueryIntent = "breaking" | "kg_change" | "fundamental";

export interface TickerContext {
  symbol: string;
  name: string;
  topEntities: Array<{ canonicalName: string; typeName: string }>;
  recentThemes: Array<{ theme: string }>;
}

export interface DeterministicQuery {
  text: string;
  intent: QueryIntent;
}

/** Base templates applied to every ticker. */
const BASE_TEMPLATES: Array<{ template: string; intent: QueryIntent }> = [
  { template: "{symbol} latest news",            intent: "breaking"    },
  { template: "{name} breaking news",            intent: "breaking"    },
  { template: "{name} earnings guidance",        intent: "fundamental" },
  { template: "{name} quarterly results",        intent: "fundamental" },
  { template: "{name} regulatory update",        intent: "fundamental" },
  { template: "{name} partnership announcement", intent: "fundamental" },
];

/**
 * Normalises a query text for deduplication (lower-case trim).
 */
const normalise = (text: string): string => text.toLowerCase().trim();

/**
 * Generates deterministic baseline queries for a ticker.
 *
 * @param ticker - Ticker context (symbol, name, entities, themes).
 * @param minCount - Minimum number of queries to return; templates cycle if needed.
 * @returns Deduped list of deterministic query candidates.
 */
export function generateDeterministicQueries(
  ticker: TickerContext,
  minCount: number,
): DeterministicQuery[] {
  const { symbol, name, topEntities, recentThemes } = ticker;
  const candidates: DeterministicQuery[] = [];

  // 1. Base templates
  for (const { template, intent } of BASE_TEMPLATES) {
    candidates.push({
      text: template.replace("{symbol}", symbol).replace("{name}", name),
      intent,
    });
  }

  // 2. Top-entity kg_change templates (up to 3 entities)
  for (const entity of topEntities.slice(0, 3)) {
    candidates.push({
      text: `${entity.canonicalName} ${symbol} latest`,
      intent: "kg_change",
    });
  }

  // 3. Recent-theme kg_change templates (up to 3 themes)
  for (const themeRow of recentThemes.slice(0, 3)) {
    candidates.push({
      text: `${themeRow.theme} ${symbol}`,
      intent: "kg_change",
    });
  }

  // 4. Deduplicate on normalised text (first occurrence wins)
  const seen = new Set<string>();
  const deduped: DeterministicQuery[] = [];
  for (const q of candidates) {
    const key = normalise(q.text);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(q);
    }
  }

  // 5. If still below minCount, cycle through base templates
  let templateIndex = 0;
  while (deduped.length < minCount && templateIndex < BASE_TEMPLATES.length * 2) {
    const t = BASE_TEMPLATES[templateIndex % BASE_TEMPLATES.length]!;
    const text = `${t.template.replace("{symbol}", symbol).replace("{name}", name)} update`;
    const key = normalise(text);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push({ text, intent: t.intent });
    }
    templateIndex++;
  }

  return deduped;
}
