/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_API_PAGE_SIZE,
  MAX_API_PAGE_SIZE,
  parseApiPageParams,
} from "./parse-api-page-params";

describe("parseApiPageParams", () => {
  it("returns defaults when query params are missing", () => {
    // Act
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents"),
    );

    // Assert
    expect(result).toEqual({ page: 1, pageSize: DEFAULT_API_PAGE_SIZE });
  });

  it("parses page and pageSize from the URL", () => {
    // Act
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents?page=2&pageSize=50"),
    );

    // Assert
    expect(result).toEqual({ page: 2, pageSize: 50 });
  });

  it("clamps invalid values to safe bounds", () => {
    // Act
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents?page=0&pageSize=500"),
    );

    // Assert
    expect(result).toEqual({ page: 1, pageSize: MAX_API_PAGE_SIZE });
  });

  it("honors custom defaults", () => {
    // Act
    const result = parseApiPageParams(
      new Request("http://localhost/api/agents"),
      { page: 3, pageSize: 10 },
    );

    // Assert
    expect(result).toEqual({ page: 3, pageSize: 10 });
  });
});
