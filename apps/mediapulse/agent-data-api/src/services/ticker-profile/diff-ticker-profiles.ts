import {
  parseProfileParties,
  type ProfileParty,
} from "../ticker-profile-parties.js";
import type { TickerProfileRecord } from "./ticker-profile-source.js";

export const RECON_COMPETITOR_COUNT = 4;

export const WELCOME_PARTY_COUNT = 5;

export const SHORT_ALIAS_LENGTH = 3;

const TEXT_FIELDS = [
  "companyOverview",
  "businessOperation",
  "sectorIndonesian",
  "sectorEnglish",
  "subSectorIndonesian",
  "subSectorEnglish",
  "industryIndonesian",
  "industryEnglish",
  "subIndustryIndonesian",
  "subIndustryEnglish",
] as const satisfies readonly (keyof TickerProfileRecord)[];

export type ProfileStatus = "both" | "databaseOnly" | "organonOnly" | "neither";

export type PartyDiff = {
  added: string[];
  removed: string[];
  renamed: { from: string; to: string }[];
};

export type TickerProfileDiff = {
  symbol: string;
  active: boolean;
  status: ProfileStatus;
  aliasesAdded: string[];
  aliasesRemoved: string[];
  shortAliasesAdded: string[];
  competitors: PartyDiff;
  regulators: PartyDiff;
  reconCompetitorOverlap: number | null;
  welcomeCompetitorOverlap: number | null;
  welcomeRegulatorOverlap: number | null;
  changedText: string[];
  blankInDatabase: string[];
  blankInOrganon: string[];
};

const lower = (value: string): string => value.trim().toLowerCase();

const namesOf = (party: ProfileParty): Set<string> =>
  new Set([party.name, ...party.aliases].map(lower));

const findMatch = (
  party: ProfileParty,
  candidates: ProfileParty[],
): ProfileParty | undefined =>
  candidates.find((candidate) => lower(candidate.name) === lower(party.name)) ??
  candidates.find((candidate) => {
    const candidateNames = namesOf(candidate);

    return [...namesOf(party)].some((name) => candidateNames.has(name));
  });

const diffParties = (
  databaseParties: ProfileParty[],
  organonParties: ProfileParty[],
): { diff: PartyDiff; matches: Map<string, string> } => {
  const diff: PartyDiff = { added: [], removed: [], renamed: [] };
  const matches = new Map<string, string>();
  const matched = new Set<ProfileParty>();
  for (const party of databaseParties) {
    const remaining = organonParties.filter(
      (candidate) => !matched.has(candidate),
    );
    const match = findMatch(party, remaining);
    if (match === undefined) {
      diff.removed.push(party.name);
      continue;
    }
    matched.add(match);
    matches.set(party.name, match.name);
    if (lower(match.name) !== lower(party.name)) {
      diff.renamed.push({ from: party.name, to: match.name });
    }
  }
  for (const party of organonParties) {
    if (!matched.has(party)) {
      diff.added.push(party.name);
    }
  }

  return { diff, matches };
};

const topOverlap = (
  databaseParties: ProfileParty[],
  organonParties: ProfileParty[],
  matches: Map<string, string>,
  count: number,
): number | null => {
  if (databaseParties.length === 0) {
    return null;
  }
  const organonTop = new Set(
    organonParties.slice(0, count).map((party) => lower(party.name)),
  );
  const databaseTop = databaseParties.slice(0, count);
  const shared = databaseTop.filter((party) => {
    const matchedName = matches.get(party.name);

    return matchedName !== undefined && organonTop.has(lower(matchedName));
  });

  return shared.length;
};

const aliasDifference = (from: string[], to: string[]): string[] => {
  const present = new Set(to.map(lower));

  return from.filter((alias) => !present.has(lower(alias)));
};

const blankFields = (profile: TickerProfileRecord): string[] =>
  TEXT_FIELDS.filter((field) => profile[field].trim() === "");

export const diffTickerProfile = (
  symbol: string,
  active: boolean,
  databaseProfile: TickerProfileRecord | undefined,
  organonProfile: TickerProfileRecord | undefined,
): TickerProfileDiff => {
  const status: ProfileStatus =
    databaseProfile !== undefined && organonProfile !== undefined
      ? "both"
      : databaseProfile !== undefined
        ? "databaseOnly"
        : organonProfile !== undefined
          ? "organonOnly"
          : "neither";
  const databaseAliases = databaseProfile?.aliases ?? [];
  const organonAliases = organonProfile?.aliases ?? [];
  const databaseCompetitors = parseProfileParties(databaseProfile?.competitors);
  const organonCompetitors = parseProfileParties(organonProfile?.competitors);
  const databaseRegulators = parseProfileParties(databaseProfile?.regulators);
  const organonRegulators = parseProfileParties(organonProfile?.regulators);
  const competitors = diffParties(databaseCompetitors, organonCompetitors);
  const regulators = diffParties(databaseRegulators, organonRegulators);
  const aliasesAdded = aliasDifference(organonAliases, databaseAliases);
  const isComparable = status === "both";

  return {
    symbol,
    active,
    status,
    aliasesAdded,
    aliasesRemoved: aliasDifference(databaseAliases, organonAliases),
    shortAliasesAdded: aliasesAdded.filter(
      (alias) => alias.trim().length <= SHORT_ALIAS_LENGTH,
    ),
    competitors: competitors.diff,
    regulators: regulators.diff,
    reconCompetitorOverlap: isComparable
      ? topOverlap(
          databaseCompetitors,
          organonCompetitors,
          competitors.matches,
          RECON_COMPETITOR_COUNT,
        )
      : null,
    welcomeCompetitorOverlap: isComparable
      ? topOverlap(
          databaseCompetitors,
          organonCompetitors,
          competitors.matches,
          WELCOME_PARTY_COUNT,
        )
      : null,
    welcomeRegulatorOverlap: isComparable
      ? topOverlap(
          databaseRegulators,
          organonRegulators,
          regulators.matches,
          WELCOME_PARTY_COUNT,
        )
      : null,
    changedText:
      databaseProfile !== undefined && organonProfile !== undefined
        ? TEXT_FIELDS.filter(
            (field) =>
              databaseProfile[field].trim() !== organonProfile[field].trim(),
          )
        : [],
    blankInDatabase:
      databaseProfile === undefined ? [] : blankFields(databaseProfile),
    blankInOrganon:
      organonProfile === undefined ? [] : blankFields(organonProfile),
  };
};

export type TickerProfileDiffSummary = {
  tickers: number;
  status: Record<ProfileStatus, number>;
  activeMissingFromOrganon: string[];
  aliasesAdded: number;
  aliasesRemoved: number;
  shortAliasesAdded: number;
  competitorsAdded: number;
  competitorsRemoved: number;
  competitorsRenamed: number;
  regulatorsAdded: number;
  regulatorsRemoved: number;
  regulatorsRenamed: number;
  averageReconCompetitorOverlap: number | null;
  averageWelcomeCompetitorOverlap: number | null;
  averageWelcomeRegulatorOverlap: number | null;
  tickersWithChangedText: number;
  tickersBlankInOrganon: string[];
};

const average = (values: (number | null)[]): number | null => {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) {
    return null;
  }
  const total = present.reduce((sum, value) => sum + value, 0);

  return Math.round((total / present.length) * 100) / 100;
};

export const summarizeTickerProfileDiffs = (
  diffs: TickerProfileDiff[],
): TickerProfileDiffSummary => {
  const status: Record<ProfileStatus, number> = {
    both: 0,
    databaseOnly: 0,
    organonOnly: 0,
    neither: 0,
  };
  for (const diff of diffs) {
    status[diff.status] += 1;
  }
  const sum = (read: (diff: TickerProfileDiff) => number): number =>
    diffs.reduce((total, diff) => total + read(diff), 0);

  return {
    tickers: diffs.length,
    status,
    activeMissingFromOrganon: diffs
      .filter((diff) => diff.active && diff.status === "databaseOnly")
      .map((diff) => diff.symbol),
    aliasesAdded: sum((diff) => diff.aliasesAdded.length),
    aliasesRemoved: sum((diff) => diff.aliasesRemoved.length),
    shortAliasesAdded: sum((diff) => diff.shortAliasesAdded.length),
    competitorsAdded: sum((diff) => diff.competitors.added.length),
    competitorsRemoved: sum((diff) => diff.competitors.removed.length),
    competitorsRenamed: sum((diff) => diff.competitors.renamed.length),
    regulatorsAdded: sum((diff) => diff.regulators.added.length),
    regulatorsRemoved: sum((diff) => diff.regulators.removed.length),
    regulatorsRenamed: sum((diff) => diff.regulators.renamed.length),
    averageReconCompetitorOverlap: average(
      diffs.map((diff) => diff.reconCompetitorOverlap),
    ),
    averageWelcomeCompetitorOverlap: average(
      diffs.map((diff) => diff.welcomeCompetitorOverlap),
    ),
    averageWelcomeRegulatorOverlap: average(
      diffs.map((diff) => diff.welcomeRegulatorOverlap),
    ),
    tickersWithChangedText: diffs.filter((diff) => diff.changedText.length > 0)
      .length,
    tickersBlankInOrganon: diffs
      .filter((diff) => diff.blankInOrganon.length > 0)
      .map((diff) => diff.symbol),
  };
};
