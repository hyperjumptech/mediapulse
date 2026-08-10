export type RankableSource = {
  sectionScore?: number | null;
  publisherAuthority?: number | null;
};

export const sectionFitOf = (source: RankableSource): number =>
  source.sectionScore ?? 0;

export const publisherAuthorityOf = (source: RankableSource): number =>
  source.publisherAuthority ?? 0;

export const compareSourcesForRanking = (
  first: RankableSource,
  second: RankableSource,
): number => {
  const fitDiff = sectionFitOf(second) - sectionFitOf(first);
  if (fitDiff !== 0) {
    return fitDiff;
  }

  return publisherAuthorityOf(second) - publisherAuthorityOf(first);
};
