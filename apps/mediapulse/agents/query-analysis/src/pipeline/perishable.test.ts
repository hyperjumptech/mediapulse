import { describe, expect, it } from "vitest";

import { isPerishableQuery, perishableReason } from "./perishable";

describe("perishableReason", () => {
  it("flags a query pinned to a day and month", () => {
    expect(perishableReason("Kopi Kenangan promo 17 Agustus 2026")).toBe(
      "dated",
    );
  });

  it("flags a query pinned to a month and year in either language", () => {
    expect(
      perishableReason("pertumbuhan kredit perbankan Indonesia Juli 2026"),
    ).toBe("dated");
    expect(
      perishableReason(
        "Bank Indonesia policy rate impact on loan growth August 2026",
      ),
    ).toBe("dated");
  });

  it("flags a query pinned to a quarter or half year", () => {
    expect(
      perishableReason(
        "Matahari Department Store performance analysis Q3 2026",
      ),
    ).toBe("dated");
    expect(perishableReason("laba emiten kuartal II 2026")).toBe("dated");
    expect(perishableReason("kinerja semester I 2026")).toBe("dated");
  });

  it("flags a query tied to a single-day event", () => {
    expect(perishableReason("FORE Coffee promo HUT RI 2026")).toBe(
      "one_off_event",
    );
    expect(perishableReason("promo diskon Lebaran ritel")).toBe(
      "one_off_event",
    );
  });

  it("flags a query carrying the figure it is searching for", () => {
    expect(
      perishableReason("Bank Mandiri kredit perbankan tumbuh 13.58%"),
    ).toBe("embedded_figure");
    expect(
      perishableReason("Haji Isam beli 62 persen saham BYAN dampak pada IHSG"),
    ).toBe("embedded_figure");
    expect(perishableReason("laba bersih naik Rp2,73 triliun")).toBe(
      "embedded_figure",
    );
  });

  it("keeps a durable query that names only a year", () => {
    expect(
      perishableReason("industri kopi Indonesia pertumbuhan pasar 2026"),
    ).toBeNull();
    expect(perishableReason("prospek batu bara Indonesia 2026")).toBeNull();
  });

  it("keeps an ordinary topical query", () => {
    expect(
      perishableReason("aplikasi pengantaran kopi di Indonesia"),
    ).toBeNull();
    expect(
      perishableReason("OJK kebijakan terbaru perbankan Indonesia"),
    ).toBeNull();
    expect(isPerishableQuery("Kideco produksi batu bara")).toBe(false);
  });
});
