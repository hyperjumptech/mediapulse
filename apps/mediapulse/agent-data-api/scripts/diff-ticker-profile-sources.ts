import { prisma } from "@mediapulse/database";
import { env } from "@mediapulse/env";

import { createDatabaseTickerProfileSource } from "../src/services/ticker-profile/database-ticker-profile-source.js";
import {
  diffTickerProfile,
  summarizeTickerProfileDiffs,
  type TickerProfileDiff,
} from "../src/services/ticker-profile/diff-ticker-profiles.js";
import { createOrganonSparqlClient } from "../src/services/ticker-profile/organon-sparql-client.js";
import { loadOrganonTickerProfiles } from "../src/services/ticker-profile/organon-ticker-profiles.js";
import { ORGANON_SPARQL_TIMEOUT_MS } from "../src/services/ticker-profile/ticker-profile-source-config.js";
import { normalizeTickerSymbol } from "../src/services/ticker-profile/ticker-profile-source.js";

export type DiffOptions = {
  symbols: string[];
  activeOnly: boolean;
  json: boolean;
  failOnMissingActive: boolean;
};

export const parseDiffOptions = (argv: readonly string[]): DiffOptions => {
  const options: DiffOptions = {
    symbols: [],
    activeOnly: false,
    json: false,
    failOnMissingActive: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--symbol") {
      const symbol = argv[index + 1];
      if (symbol === undefined) {
        throw new Error("--symbol needs a ticker symbol");
      }
      options.symbols.push(normalizeTickerSymbol(symbol));
      index += 1;
    } else if (argument === "--active-only") {
      options.activeOnly = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--fail-on-missing-active") {
      options.failOnMissingActive = true;
    } else if (argument !== "--") {
      throw new Error(`Unknown option ${argument}`);
    }
  }

  return options;
};

const describeDiff = (diff: TickerProfileDiff): string[] => {
  const lines = [
    `${diff.symbol}${diff.active ? " (active)" : ""}: ${diff.status}`,
  ];
  const add = (label: string, values: string[]) => {
    if (values.length > 0) {
      lines.push(`  ${label}: ${values.join(", ")}`);
    }
  };
  add("aliases added", diff.aliasesAdded);
  add("aliases removed", diff.aliasesRemoved);
  add("competitors added", diff.competitors.added);
  add("competitors removed", diff.competitors.removed);
  add(
    "competitors renamed",
    diff.competitors.renamed.map((rename) => `${rename.from} → ${rename.to}`),
  );
  add("regulators added", diff.regulators.added);
  add("regulators removed", diff.regulators.removed);
  add(
    "regulators renamed",
    diff.regulators.renamed.map((rename) => `${rename.from} → ${rename.to}`),
  );
  add("text changed", diff.changedText);
  add("blank in Organon", diff.blankInOrganon);
  if (diff.reconCompetitorOverlap !== null) {
    lines.push(
      `  top competitors kept: recon ${diff.reconCompetitorOverlap}/4, welcome ${diff.welcomeCompetitorOverlap}/5; welcome regulators kept ${diff.welcomeRegulatorOverlap}/5`,
    );
  }

  return lines;
};

const run = async (): Promise<number> => {
  const options = parseDiffOptions(process.argv.slice(2));
  const baseUrl = env.ORGANON_API_URL?.trim() ?? "";
  const apiKey = env.ORGANON_API_KEY?.trim() ?? "";
  if (baseUrl === "" || apiKey === "") {
    throw new Error(
      "Set ORGANON_API_URL and ORGANON_API_KEY to compare with Organon",
    );
  }
  const tickers = await prisma.ticker.findMany({
    where:
      options.symbols.length > 0 ? { symbol: { in: options.symbols } } : {},
    select: {
      symbol: true,
      searchQuerySets: {
        where: { isActive: true },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { symbol: "asc" },
  });
  const selected = tickers.filter(
    (ticker) => !options.activeOnly || ticker.searchQuerySets.length > 0,
  );
  const symbols = selected.map((ticker) => ticker.symbol);
  const databaseProfiles = await createDatabaseTickerProfileSource({
    tickerProfile: prisma.tickerProfile,
  })(symbols);
  const organonProfiles = await loadOrganonTickerProfiles(
    createOrganonSparqlClient({
      baseUrl,
      apiKey,
      timeoutMs: ORGANON_SPARQL_TIMEOUT_MS,
    }),
  );
  const diffs = selected.map((ticker) =>
    diffTickerProfile(
      ticker.symbol,
      ticker.searchQuerySets.length > 0,
      databaseProfiles.get(ticker.symbol),
      organonProfiles.get(normalizeTickerSymbol(ticker.symbol)),
    ),
  );
  const summary = summarizeTickerProfileDiffs(diffs);
  if (options.json) {
    console.log(JSON.stringify({ summary, diffs }, null, 2));
  } else {
    for (const diff of diffs) {
      console.log(describeDiff(diff).join("\n"));
    }
    console.log(JSON.stringify(summary, null, 2));
  }

  return options.failOnMissingActive &&
    summary.activeMissingFromOrganon.length > 0
    ? 1
    : 0;
};

if (import.meta.main) {
  run()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
