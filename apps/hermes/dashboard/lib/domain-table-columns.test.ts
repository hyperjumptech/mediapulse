import { describe, expect, it } from "vitest";

import {
  buildDomainTableDefaultColumnVisibility,
  buildDomainTableId,
  buildDomainTableItemHref,
  formatDomainDuration,
  formatDomainNumber,
  formatDomainTableCellValue,
  isEmptyDomainCellValue,
  isNumericDomainColumnFormat,
  mergeDomainTableColumnVisibility,
  readDomainTableRowId,
  resolveDomainColumnFormat,
  resolveDomainColumnMobileRole,
  resolveDomainDateTimeZone,
  stringifyDomainCellValue,
  toDomainCellBoolean,
  toDomainCellNumber,
  type DomainTableColumn,
} from "./domain-table-columns";

const formatOptions = {
  timeZone: "Asia/Jakarta",
  now: new Date("2026-09-28T12:00:00.000Z"),
};

const column = (
  overrides: Partial<DomainTableColumn> = {},
): DomainTableColumn => ({
  key: "value",
  label: "Value",
  type: "text",
  ...overrides,
});

describe("resolveDomainColumnFormat", () => {
  it("prefers the format hint over the legacy type", () => {
    expect(
      resolveDomainColumnFormat(column({ type: "text", format: "number" })),
    ).toBe("number");
  });

  it("falls back to the legacy type", () => {
    expect(resolveDomainColumnFormat(column({ type: "date-time" }))).toBe(
      "date-time",
    );
  });
});

describe("isNumericDomainColumnFormat", () => {
  it("treats number and duration columns as numeric", () => {
    expect(isNumericDomainColumnFormat("number")).toBe(true);
    expect(isNumericDomainColumnFormat("duration-ms")).toBe(true);
    expect(isNumericDomainColumnFormat("text")).toBe(false);
  });
});

describe("isEmptyDomainCellValue", () => {
  it("treats null, undefined and blank strings as empty", () => {
    expect(isEmptyDomainCellValue(null)).toBe(true);
    expect(isEmptyDomainCellValue(undefined)).toBe(true);
    expect(isEmptyDomainCellValue("   ")).toBe(true);
  });

  it("keeps zero and false as values", () => {
    expect(isEmptyDomainCellValue(0)).toBe(false);
    expect(isEmptyDomainCellValue(false)).toBe(false);
  });
});

describe("stringifyDomainCellValue", () => {
  it("serializes objects as JSON instead of [object Object]", () => {
    expect(stringifyDomainCellValue({ a: 1 })).toBe('{"a":1}');
  });

  it("renders dates as ISO strings and booleans as Yes or No", () => {
    expect(stringifyDomainCellValue(new Date("2026-01-02T03:04:05.000Z"))).toBe(
      "2026-01-02T03:04:05.000Z",
    );
    expect(stringifyDomainCellValue(true)).toBe("Yes");
  });
});

describe("toDomainCellNumber", () => {
  it("accepts finite numbers and numeric strings", () => {
    expect(toDomainCellNumber(42)).toBe(42);
    expect(toDomainCellNumber("1250.5")).toBe(1250.5);
  });

  it("rejects non-numeric values", () => {
    expect(toDomainCellNumber("abc")).toBeNull();
    expect(toDomainCellNumber(Number.NaN)).toBeNull();
    expect(toDomainCellNumber("")).toBeNull();
    expect(toDomainCellNumber(true)).toBeNull();
  });
});

describe("toDomainCellBoolean", () => {
  it("accepts booleans and their string forms", () => {
    expect(toDomainCellBoolean(true)).toBe(true);
    expect(toDomainCellBoolean("false")).toBe(false);
    expect(toDomainCellBoolean("yes")).toBeNull();
  });
});

describe("formatDomainNumber and formatDomainDuration", () => {
  it("groups thousands in en-US", () => {
    expect(formatDomainNumber(1234567.5)).toBe("1,234,567.5");
  });

  it("formats milliseconds as a short duration", () => {
    expect(formatDomainDuration(1200)).toBe("1.2s");
    expect(formatDomainDuration(130_000)).toBe("2m 10s");
    expect(formatDomainDuration(850.4)).toBe("850 ms");
  });
});

describe("resolveDomainDateTimeZone", () => {
  it("pins date-only strings to UTC so they never shift a day", () => {
    expect(resolveDomainDateTimeZone("2026-09-28")).toBe("UTC");
  });

  it("leaves timestamps in the viewer zone", () => {
    expect(
      resolveDomainDateTimeZone("2026-09-28T01:00:00.000Z"),
    ).toBeUndefined();
  });
});

describe("formatDomainTableCellValue", () => {
  it("formats ISO values in the viewer time zone", () => {
    expect(
      formatDomainTableCellValue(
        column({ type: "date-time" }),
        "2025-01-01T12:00:00.000Z",
        formatOptions,
      ),
    ).toBe("Jan 1, 2025, 19:00");
  });

  it("drops the year for dates in the current year", () => {
    expect(
      formatDomainTableCellValue(
        column({ type: "date-time" }),
        "2026-09-27T20:30:00.000Z",
        formatOptions,
      ),
    ).toBe("Sep 28, 03:30");
  });

  it("uses the requested date-time style", () => {
    expect(
      formatDomainTableCellValue(
        column({ type: "date-time" }),
        "2026-09-27T20:30:00.000Z",
        { ...formatOptions, style: "datetime" },
      ),
    ).toBe("Sep 28, 2026, 03:30");
  });

  it("formats date columns without a time", () => {
    expect(
      formatDomainTableCellValue(
        column({ format: "date" }),
        "2026-09-27",
        formatOptions,
      ),
    ).toBe("Sep 27, 2026");
  });

  it("keeps non-date columns as plain string values", () => {
    expect(formatDomainTableCellValue(column(), "alpha", formatOptions)).toBe(
      "alpha",
    );
  });

  it("falls back safely for unparseable date-time values", () => {
    expect(
      formatDomainTableCellValue(
        column({ type: "date-time" }),
        "not-a-date",
        formatOptions,
      ),
    ).toBe("not-a-date");
  });

  it("renders boolean values as Yes/No", () => {
    expect(formatDomainTableCellValue(column(), true, formatOptions)).toBe(
      "Yes",
    );
    expect(
      formatDomainTableCellValue(
        column({ format: "boolean" }),
        "false",
        formatOptions,
      ),
    ).toBe("No");
  });

  it("formats numbers and durations", () => {
    expect(
      formatDomainTableCellValue(
        column({ format: "number" }),
        12500,
        formatOptions,
      ),
    ).toBe("12,500");
    expect(
      formatDomainTableCellValue(
        column({ format: "duration-ms" }),
        "1200",
        formatOptions,
      ),
    ).toBe("1.2s");
  });

  it("falls back to the raw text for values the format cannot read", () => {
    expect(
      formatDomainTableCellValue(
        column({ format: "number" }),
        "n/a",
        formatOptions,
      ),
    ).toBe("n/a");
    expect(
      formatDomainTableCellValue(
        column({ format: "boolean" }),
        "maybe",
        formatOptions,
      ),
    ).toBe("maybe");
  });

  it("humanizes badge values", () => {
    expect(
      formatDomainTableCellValue(
        column({ format: "badge" }),
        "in_progress",
        formatOptions,
      ),
    ).toBe("in progress");
  });

  it("returns an empty string for empty values", () => {
    expect(
      formatDomainTableCellValue(
        column({ format: "number" }),
        null,
        formatOptions,
      ),
    ).toBe("");
  });
});

describe("resolveDomainColumnMobileRole", () => {
  it("always makes the first column the title", () => {
    expect(resolveDomainColumnMobileRole({ mobile: "hidden" }, 0)).toBe(
      "title",
    );
  });

  it("shows the next four columns as fields and hides the rest", () => {
    expect(resolveDomainColumnMobileRole({}, 1)).toBe("field");
    expect(resolveDomainColumnMobileRole({}, 4)).toBe("field");
    expect(resolveDomainColumnMobileRole({}, 5)).toBe("hidden");
  });

  it("honors the manifest role", () => {
    expect(resolveDomainColumnMobileRole({ mobile: "badge" }, 7)).toBe("badge");
    expect(resolveDomainColumnMobileRole({ mobile: "hidden" }, 1)).toBe(
      "hidden",
    );
  });

  it("turns a second title into a subtitle so the card still shows it", () => {
    expect(resolveDomainColumnMobileRole({ mobile: "title" }, 2)).toBe(
      "subtitle",
    );
  });
});

describe("buildDomainTableId", () => {
  it("prefixes the integration and resource", () => {
    expect(buildDomainTableId("mediapulse", "tickers")).toBe(
      "domain-mediapulse-tickers",
    );
  });

  it("replaces characters a cookie name cannot hold", () => {
    expect(buildDomainTableId("acme corp", "a/b;c")).toBe(
      "domain-acme_corp-a_b_c",
    );
  });
});

describe("column visibility", () => {
  const columns = [
    { key: "name", defaultHidden: true },
    { key: "createdAt", defaultHidden: true },
    { key: "status" },
  ];

  it("hides defaultHidden columns except the title", () => {
    expect(buildDomainTableDefaultColumnVisibility(columns)).toEqual({
      createdAt: false,
    });
  });

  it("lets saved choices override the defaults", () => {
    expect(
      mergeDomainTableColumnVisibility(columns, {
        createdAt: true,
        status: false,
      }),
    ).toEqual({ createdAt: true, status: false });
  });

  it("never hides the title column from a stale cookie", () => {
    expect(mergeDomainTableColumnVisibility(columns, { name: false })).toEqual({
      createdAt: false,
    });
  });
});

describe("row helpers", () => {
  it("reads the row id as a string", () => {
    expect(readDomainTableRowId({ id: 7 })).toBe("7");
    expect(readDomainTableRowId({})).toBe("");
  });

  it("encodes the row id in the item href", () => {
    expect(buildDomainTableItemHref("/dashboard/acme/items", "a b")).toBe(
      "/dashboard/acme/items/a%20b",
    );
  });
});
