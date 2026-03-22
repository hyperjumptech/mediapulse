import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
} from "./list-pagination";

describe("parsePagination", () => {
  it("uses defaults when query params are omitted", () => {
    // Act
    const result = parsePagination(undefined, undefined);

    // Assert
    expect(result).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it("coerces invalid page to 1 and falls back pageSize when NaN", () => {
    // Act
    const result = parsePagination("0", "not-a-number");

    // Assert
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("caps page size at MAX_PAGE_SIZE", () => {
    // Act
    const result = parsePagination("2", "9999");

    // Assert
    expect(result).toEqual({ page: 2, pageSize: MAX_PAGE_SIZE });
  });

  it("raises page to at least 1 and pageSize to at least 1", () => {
    // Act
    const result = parsePagination("-5", "0");

    // Assert
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(1);
  });
});
