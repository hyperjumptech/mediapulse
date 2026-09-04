/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { quotedLevelDate } from "./claim-date";

describe("quotedLevelDate", () => {
  it.each([
    [
      "Antam Gold Price at Pegadaian August 29, 2026, Check the Latest Details",
      "2026-08-29",
    ],
    [
      "Harga Emas Antam di Pegadaian 29 Agustus 2026, Cek Rinciannya",
      "2026-08-29",
    ],
    [
      "Kurs Dolar AS di BCA, Bank Mandiri, BRI & BNI Hari Ini, 3 September 2026",
      "2026-09-03",
    ],
  ])("reads the quoted date from %s", (title, expected) => {
    expect(quotedLevelDate(title)?.toISOString().slice(0, 10)).toBe(expected);
  });

  it("ignores a dated corporate action, which states no level", () => {
    expect(
      quotedLevelDate(
        "Erajaya Prepares Rp 500 Billion Stock Buyback Starting September 4, 2026",
      ),
    ).toBeNull();
  });

  it("ignores a headline that quotes neither a level nor a date", () => {
    expect(
      quotedLevelDate("Vale Prepares to Operate 3 HPAL Nickel Smelters"),
    ).toBeNull();
  });

  it("ignores a dated headline that quotes no level", () => {
    expect(
      quotedLevelDate("Vale Opens National Job Vacancies on 8 September 2026"),
    ).toBeNull();
  });

  it("ignores a level with no date", () => {
    expect(
      quotedLevelDate("Harga Batu Bara Acuan Naik ke US$126,87 per Ton"),
    ).toBeNull();
  });
});
