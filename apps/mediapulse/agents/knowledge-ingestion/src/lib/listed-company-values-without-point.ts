import type {
  ArticlePoint,
  MarketRelations,
  WrittenLink,
} from "@mediapulse/knowledge-graph";

export type ListedCompanyValueWithoutPoint = {
  company: string;
  relation: string;
  value: string;
};

const pointStates = (
  point: ArticlePoint,
  link: WrittenLink,
  sameRelations: ReadonlySet<string>,
): boolean => {
  if (
    point.statesRelation === null ||
    !sameRelations.has(point.statesRelation)
  ) {
    return false;
  }
  const parties = new Set([...point.about, ...point.relationObjects]);

  return parties.has(link.subject) && parties.has(link.object);
};

export const marketLinksOf = (
  links: readonly WrittenLink[],
  relations: MarketRelations,
): WrittenLink[] => links.filter((link) => relations.has(link.predicate));

export const listedCompanyValuesWithoutPoint = ({
  links,
  points,
  relations,
  listedCompanies,
}: {
  links: readonly WrittenLink[];
  points: readonly ArticlePoint[];
  relations: MarketRelations;
  listedCompanies: ReadonlySet<string>;
}): ListedCompanyValueWithoutPoint[] => {
  const found = new Map<string, ListedCompanyValueWithoutPoint>();
  for (const link of links) {
    const sameRelations = relations.get(link.predicate);
    if (sameRelations === undefined) {
      continue;
    }
    const subjectIsListed = listedCompanies.has(link.subject);
    if (!subjectIsListed && !listedCompanies.has(link.object)) {
      continue;
    }
    if (points.some((point) => pointStates(point, link, sameRelations))) {
      continue;
    }
    const company = subjectIsListed ? link.subject : link.object;
    const value = subjectIsListed ? link.object : link.subject;
    const key = [company, value, [...sameRelations].sort().join(" ")].join("|");
    if (!found.has(key)) {
      found.set(key, { company, relation: link.predicate, value });
    }
  }

  return [...found.values()];
};
