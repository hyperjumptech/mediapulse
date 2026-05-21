import {
  DEFAULT_DETERMINISTIC_PACK,
  DEFAULT_TEMPLATE_PACK_BY_LANGUAGE,
  type DeterministicPackName,
} from "./templates/deterministic-packs";
import { primaryLanguageSubtag } from "./i18n/entity-aliases";

/** One language slice of the query budget with optional pack override. */
export type LanguageQuota = {
  language: string;
  share: number;
  templatePack?: string;
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
 * Resolves effective language quotas from Hermes config, lifting legacy `allowedLanguages`.
 *
 * @param config - Parsed or raw invoke config language fields.
 * @returns Normalized quota list whose shares sum to 1.0.
 */
export const resolveLanguageQuotas = (config: {
  languageQuotas?: LanguageQuota[];
  allowedLanguages?: string[];
}): LanguageQuota[] => {
  if (config.languageQuotas !== undefined && config.languageQuotas.length > 0) {
    return config.languageQuotas;
  }
  const languages = config.allowedLanguages ?? ["en"];
  if (languages.length === 0) {
    return [{ language: "en", share: 1 }];
  }
  const share = 1 / languages.length;
  return languages.map((language) => ({ language, share }));
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

/**
 * Resolves the deterministic template pack for a language slice.
 *
 * @param language - BCP-47 language tag for the slice.
 * @param quotaTemplatePack - Optional per-quota pack override.
 * @param globalTemplatePack - Hermes `templatePack` default for the run.
 * @returns Pack name to pass to {@link buildDeterministicQueries}.
 */
export const resolveLanguageTemplatePack = (
  language: string,
  quotaTemplatePack: string | undefined,
  globalTemplatePack: DeterministicPackName | string,
): string => {
  if (quotaTemplatePack !== undefined && quotaTemplatePack.length > 0) {
    return quotaTemplatePack;
  }
  const primary = primaryLanguageSubtag(language);
  const localized = DEFAULT_TEMPLATE_PACK_BY_LANGUAGE[primary];
  if (localized !== undefined) {
    return localized;
  }
  return globalTemplatePack || DEFAULT_DETERMINISTIC_PACK;
};
