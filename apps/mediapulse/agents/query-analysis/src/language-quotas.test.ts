/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  distributeQueryCountAcrossLanguages,
  languageQuotaSharesAreValid,
  resolveLanguageQuotas,
  resolveLanguageTemplatePack,
} from "./language-quotas";

describe("languageQuotaSharesAreValid", () => {
  it("returns true when shares sum to 1.0", () => {
    expect(
      languageQuotaSharesAreValid([
        { language: "en", share: 0.6 },
        { language: "id", share: 0.4 },
      ]),
    ).toBe(true);
  });

  it("returns false when shares sum away from 1.0", () => {
    expect(
      languageQuotaSharesAreValid([
        { language: "en", share: 0.59 },
        { language: "id", share: 0.4 },
      ]),
    ).toBe(false);
  });
});

describe("resolveLanguageQuotas", () => {
  it("returns explicit languageQuotas when provided", () => {
    const quotas = [
      { language: "en", share: 0.6 },
      { language: "id", share: 0.4 },
    ];
    expect(resolveLanguageQuotas({ languageQuotas: quotas })).toEqual(quotas);
  });

  it("defaults to English-only when languageQuotas is omitted", () => {
    expect(resolveLanguageQuotas({})).toEqual([{ language: "en", share: 1 }]);
  });
});

describe("distributeQueryCountAcrossLanguages", () => {
  it("assigns 6 English and 4 Indonesian rows for 60/40 split over 10", () => {
    const distributed = distributeQueryCountAcrossLanguages(10, [
      { language: "en", share: 0.6 },
      { language: "id", share: 0.4 },
    ]);

    expect(distributed).toEqual([
      { language: "en", share: 0.6, queryCount: 6 },
      { language: "id", share: 0.4, queryCount: 4 },
    ]);
    expect(distributed.reduce((sum, row) => sum + row.queryCount, 0)).toBe(10);
  });
});

describe("resolveLanguageTemplatePack", () => {
  it("prefers per-quota templatePack override", () => {
    expect(resolveLanguageTemplatePack("id", "kg-aware-v1", "default-v1")).toBe(
      "kg-aware-v1",
    );
  });

  it("selects localized default pack by primary language subtag", () => {
    expect(resolveLanguageTemplatePack("id-ID", undefined, "default-v1")).toBe(
      "default-id-v1",
    );
    expect(resolveLanguageTemplatePack("en", undefined, "default-v1")).toBe(
      "default-en-v1",
    );
  });

  it("falls back to global templatePack when no localized pack exists", () => {
    expect(resolveLanguageTemplatePack("de", undefined, "rich-v2")).toBe(
      "rich-v2",
    );
  });
});
