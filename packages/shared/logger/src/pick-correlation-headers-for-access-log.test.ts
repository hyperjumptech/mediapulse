import { describe, expect, it } from "vitest";

import {
  HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES,
  pickHermesCorrelationHeadersForAccessLog,
} from "./pick-correlation-headers-for-access-log.js";

describe("pickHermesCorrelationHeadersForAccessLog", () => {
  it("maps mixed-case correlation headers to canonical lowercase keys", () => {
    // Act
    const result = pickHermesCorrelationHeadersForAccessLog({
      "X-Job-Id": "j1",
      "X-Pipeline-Step-Id": "s1",
      Accept: "*/*",
    });

    // Assert
    expect(result).toEqual({
      "x-job-id": "j1",
      "x-pipeline-step-id": "s1",
    });
  });

  it("drops empty and undefined values", () => {
    // Act
    const result = pickHermesCorrelationHeadersForAccessLog({
      "x-job-id": "",
      "x-execution-id": undefined,
      "x-manual-execution-id": "m1",
    });

    // Assert
    expect(result).toEqual({ "x-manual-execution-id": "m1" });
  });

  it("returns empty object when no correlation headers match", () => {
    // Act
    const result = pickHermesCorrelationHeadersForAccessLog({
      authorization: "Bearer x",
      host: "localhost",
    });

    // Assert
    expect(result).toEqual({});
  });
});

describe("HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES", () => {
  it("lists six Hermes correlation header names", () => {
    // Assert
    expect(HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES).toHaveLength(6);
    expect(HERMES_ACCESS_LOG_CORRELATION_HEADER_NAMES).toContain("x-job-id");
  });
});
