/** @vitest-environment node */
import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  formatDomainTableCellValue,
  type DomainTableColumnForDisplay,
} from "./domain-table-page";

const dateTimeColumn: DomainTableColumnForDisplay = {
  key: "createdAt",
  label: "Created",
  type: "date-time",
};

const textColumn: DomainTableColumnForDisplay = {
  key: "name",
  label: "Name",
  type: "text",
};

describe("formatDomainTableCellValue", () => {
  it("formats ISO values for date-time columns", () => {
    // Setup
    const iso = "2025-01-01T12:00:00.000Z";
    const expected = format(new Date(iso), "LLL d, yyyy");

    // Act
    const result = formatDomainTableCellValue(dateTimeColumn, iso);

    // Assert
    expect(result).toBe(expected);
    expect(result).not.toBe(iso);
  });

  it("keeps non-date columns as plain string values", () => {
    // Setup
    const value = "alpha";

    // Act
    const result = formatDomainTableCellValue(textColumn, value);

    // Assert
    expect(result).toBe("alpha");
  });

  it("falls back safely for unparseable date-time values", () => {
    // Setup
    const badDate = "not-a-date";

    // Act
    const result = formatDomainTableCellValue(dateTimeColumn, badDate);

    // Assert
    expect(result).toBe("not-a-date");
  });
});
