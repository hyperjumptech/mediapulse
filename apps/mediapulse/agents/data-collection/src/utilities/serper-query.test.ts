/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import {
  buildSerperRequestBody,
  resolveSerperEndpoint,
  serperDateRangeToTbs,
  serperQueryConfigSchema,
} from "./serper-query";

describe("serperDateRangeToTbs", () => {
  it("maps past_week to qdr:w", () => {
    // Act
    const tbs = serperDateRangeToTbs("past_week");

    // Assert
    expect(tbs).toBe("qdr:w");
  });

  it("returns undefined for all", () => {
    // Act
    const tbs = serperDateRangeToTbs("all");

    // Assert
    expect(tbs).toBeUndefined();
  });
});

describe("resolveSerperEndpoint", () => {
  it("uses the news path when type is news", () => {
    // Act
    const endpoint = resolveSerperEndpoint(
      "https://google.serper.dev/search",
      "news",
    );

    // Assert
    expect(endpoint).toBe("https://google.serper.dev/news");
  });

  it("uses the search path when type is search", () => {
    // Act
    const endpoint = resolveSerperEndpoint(
      "https://google.serper.dev/news",
      "search",
    );

    // Assert
    expect(endpoint).toBe("https://google.serper.dev/search");
  });
});

describe("buildSerperRequestBody", () => {
  it("builds the default Indonesia news payload with past week and auto language", () => {
    // Setup
    const queryConfig = serperQueryConfigSchema.parse({});

    // Act
    const body = buildSerperRequestBody("BBCA stock news", queryConfig);

    // Assert
    expect(body).toEqual({
      q: "BBCA stock news",
      gl: "id",
      type: "news",
      tbs: "qdr:w",
    });
  });

  it("includes hl when language is not auto", () => {
    // Setup
    const queryConfig = serperQueryConfigSchema.parse({
      language: "en",
      type: "search",
      dateRange: "past_day",
    });

    // Act
    const body = buildSerperRequestBody("query", queryConfig);

    // Assert
    expect(body).toEqual({
      q: "query",
      gl: "id",
      hl: "en",
      tbs: "qdr:d",
    });
  });

  it("omits tbs when dateRange is all", () => {
    // Setup
    const queryConfig = serperQueryConfigSchema.parse({ dateRange: "all" });

    // Act
    const body = buildSerperRequestBody("query", queryConfig);

    // Assert
    expect(body).not.toHaveProperty("tbs");
  });
});

describe("serperQueryConfigSchema", () => {
  it("defaults to Indonesia, auto language, past week, and news", () => {
    // Act
    const parsed = serperQueryConfigSchema.parse({});

    // Assert
    expect(parsed).toEqual({
      country: "id",
      language: "auto",
      dateRange: "past_week",
      type: "news",
    });
  });
});
