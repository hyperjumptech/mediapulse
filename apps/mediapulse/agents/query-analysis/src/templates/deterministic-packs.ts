import type { QueryAnalysisIntent } from "@workspace/agent-data-api-contract";

/** Named deterministic template pack identifiers. */
export const DETERMINISTIC_PACK_NAMES = [
  "default-v1",
  "rich-v2",
  "rich-v2-extended",
] as const;

/** Valid `templatePack` config value. */
export type DeterministicPackName = (typeof DETERMINISTIC_PACK_NAMES)[number];

/** Default pack when Hermes omits `templatePack` or passes an unknown value. */
export const DEFAULT_DETERMINISTIC_PACK: DeterministicPackName = "default-v1";

/** Maximum templates evaluated per pack to avoid dominating merge/dedup work. */
export const MAX_TEMPLATES_PER_PACK = 25;

/** One row in a deterministic template pack before slot resolution. */
export type DeterministicTemplate = {
  template: string;
  intent: QueryAnalysisIntent;
};

/** A named collection of deterministic query templates. */
export type DeterministicPack = {
  name: DeterministicPackName;
  templates: DeterministicTemplate[];
};

/** Original five-template baseline (symbol/name only). */
const defaultV1Pack: DeterministicPack = {
  name: "default-v1",
  templates: [
    { template: "{symbol} latest news", intent: "breaking" },
    { template: "{name} breaking news", intent: "breaking" },
    { template: "{name} relation changes", intent: "kg_change" },
    { template: "{name} earnings guidance", intent: "fundamental" },
    { template: "{name} regulatory update", intent: "fundamental" },
  ],
};

/** Expanded pack with comparative, time-anchored, theme-, entity-, and question-form angles. */
const richV2Pack: DeterministicPack = {
  name: "rich-v2",
  templates: [
    { template: "{symbol} latest news", intent: "breaking" },
    { template: "{name} breaking news", intent: "breaking" },
    { template: "why is {symbol} moving today", intent: "breaking" },
    { template: "why is {symbol} falling", intent: "breaking" },
    { template: "{name} {recentTheme} reaction", intent: "breaking" },
    { template: "{name} relation changes", intent: "kg_change" },
    { template: "{topEntity} impact on {name}", intent: "kg_change" },
    { template: "{name} {topEntity} risk", intent: "kg_change" },
    { template: "{name} earnings guidance", intent: "fundamental" },
    { template: "{name} regulatory update", intent: "fundamental" },
    { template: "{name} {currentQuarter} earnings", intent: "fundamental" },
    {
      template: "{symbol} guidance update {currentYear}",
      intent: "fundamental",
    },
    { template: "{name} vs sector peers", intent: "fundamental" },
    { template: "{name} vs peers {currentQuarter}", intent: "fundamental" },
    { template: "{name} market share {currentYear}", intent: "fundamental" },
    { template: "{name} {currentQuarter} guidance", intent: "fundamental" },
    { template: "{name} {recentTheme} analyst view", intent: "fundamental" },
    { template: "{name} {recentTheme} impact", intent: "fundamental" },
    { template: "is {name} a buy {currentMonth}", intent: "fundamental" },
    { template: "is {name} a buy now", intent: "fundamental" },
    { template: "{name} long-term thesis", intent: "fundamental" },
    { template: "{name} bear case", intent: "fundamental" },
    { template: "{name} bull case", intent: "fundamental" },
  ],
};

/** Opt-in pack extending rich-v2 with coverage for the expanded intent taxonomy. */
const richV2ExtendedPack: DeterministicPack = {
  name: "rich-v2-extended",
  templates: [
    { template: "{symbol} latest news", intent: "breaking" },
    { template: "why is {symbol} moving today", intent: "breaking" },
    { template: "{name} {recentTheme} reaction", intent: "breaking" },
    { template: "{name} relation changes", intent: "kg_change" },
    { template: "{topEntity} impact on {name}", intent: "kg_change" },
    { template: "{name} earnings guidance", intent: "fundamental" },
    { template: "{name} vs sector peers", intent: "fundamental" },
    { template: "{name} {currentQuarter} guidance", intent: "fundamental" },
    { template: "{name} social media sentiment", intent: "sentiment" },
    { template: "{name} analyst sentiment shift", intent: "sentiment" },
    {
      template: "{name} vs {topEntity} competitive threat",
      intent: "competitor",
    },
    {
      template: "{name} market share vs peers {currentYear}",
      intent: "competitor",
    },
    { template: "{name} supplier risk", intent: "supply_chain" },
    { template: "{name} supply chain disruption", intent: "supply_chain" },
    { template: "{name} ESG controversies", intent: "esg" },
    { template: "{name} sustainability disclosure", intent: "esg" },
    { template: "{name} interest rate sensitivity", intent: "macro" },
    { template: "{name} FX headwind {currentQuarter}", intent: "macro" },
    { template: "{name} chart pattern {currentMonth}", intent: "technical" },
    { template: "{symbol} support resistance levels", intent: "technical" },
  ],
};

/** All registered deterministic template packs keyed by name. */
export const DETERMINISTIC_PACKS: Record<
  DeterministicPackName,
  DeterministicPack
> = {
  "default-v1": defaultV1Pack,
  "rich-v2": richV2Pack,
  "rich-v2-extended": richV2ExtendedPack,
};

/**
 * Returns the template pack for a configured pack name.
 *
 * @param packName - Hermes `templatePack` value.
 * @returns Pack definition capped at {@link MAX_TEMPLATES_PER_PACK} templates.
 */
export const getDeterministicPack = (
  packName: DeterministicPackName | string,
): DeterministicPack => {
  const resolvedName =
    packName in DETERMINISTIC_PACKS
      ? (packName as DeterministicPackName)
      : DEFAULT_DETERMINISTIC_PACK;
  const pack = DETERMINISTIC_PACKS[resolvedName];
  return {
    ...pack,
    templates: pack.templates.slice(0, MAX_TEMPLATES_PER_PACK),
  };
};
