/** One language slice of the query budget. */
export type LanguageQuota = {
  language: string;
  share: number;
};

/** Language quota with an assigned integer row count. */
export type DistributedLanguageQuota = LanguageQuota & {
  queryCount: number;
};

const SHARE_SUM_TOLERANCE = 0.001;

/**
 * Validates that language quota shares sum to 1.0 within tolerance.
 *
 * @param quotas - Parsed language quota rows.
 * @returns `true` when shares sum to approximately 1.0.
 */
export const languageQuotaSharesAreValid = (
  quotas: LanguageQuota[],
): boolean => {
  if (quotas.length === 0) {
    return false;
  }
  const sum = quotas.reduce((total, quota) => total + quota.share, 0);
  return Math.abs(sum - 1) <= SHARE_SUM_TOLERANCE;
};

/**
 * Resolves effective language quotas from the parsed `output` config group.
 *
 * @param output - Parsed invoke config `output` group.
 * @returns Normalized quota list defaulting to English-only when omitted.
 */
export const resolveLanguageQuotas = (output: {
  languageQuotas?: LanguageQuota[];
}): LanguageQuota[] => {
  if (output.languageQuotas !== undefined && output.languageQuotas.length > 0) {
    return output.languageQuotas;
  }
  return [{ language: "en", share: 1 }];
};

/**
 * Distributes an integer query budget across language quotas (largest-remainder method).
 *
 * @param totalCount - Total rows to allocate across languages.
 * @param quotas - Language shares that sum to 1.0.
 * @returns Quotas with `queryCount` assigned; sum equals `totalCount`.
 */
export const distributeQueryCountAcrossLanguages = (
  totalCount: number,
  quotas: LanguageQuota[],
): DistributedLanguageQuota[] => {
  if (quotas.length === 0 || totalCount <= 0) {
    return [];
  }

  const entries = quotas.map((quota) => {
    const exact = totalCount * quota.share;
    return {
      ...quota,
      exact,
      queryCount: Math.floor(exact),
    };
  });

  let remainder =
    totalCount - entries.reduce((sum, row) => sum + row.queryCount, 0);
  const byRemainder = [...entries].sort(
    (left, right) =>
      right.exact - right.queryCount - (left.exact - left.queryCount),
  );

  for (let index = 0; remainder > 0; index += 1) {
    byRemainder[index % byRemainder.length]!.queryCount += 1;
    remainder -= 1;
  }

  return entries.map(({ exact: _exact, ...quota }) => quota);
};
