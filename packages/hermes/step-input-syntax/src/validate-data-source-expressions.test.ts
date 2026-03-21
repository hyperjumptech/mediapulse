/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  validateDataSourceExpressions,
  type ValidateDataSourceExpressionsResult,
} from "./validate-data-source-expressions";

describe("validateDataSourceExpressions", () => {
  it("returns valid when no data source strings", () => {
    const result = validateDataSourceExpressions({
      tickerId: "literal-id",
      foo: 123,
    });

    expect(result).toEqual({ valid: true });
  });

  it("returns valid when data source string parses and take in bounds", () => {
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker:id?take=100",
    });

    expect(result).toEqual({ valid: true });
  });

  it("returns invalid when data source string has bad format", () => {
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker",
    }) as ValidateDataSourceExpressionsResult & { valid: false };

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Param "tickerId": invalid data source format. Expected db:table:field?options',
    );
  });

  it("returns invalid when take exceeds MAX_TAKE", () => {
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker:id?take=10000",
    }) as ValidateDataSourceExpressionsResult & { valid: false };

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.includes("exceeds max"))).toBe(
      true,
    );
  });

  it("allows take above default MAX_TAKE when options.maxTake is higher", () => {
    const result = validateDataSourceExpressions(
      { tickerId: "db:ticker:id?take=8000" },
      { maxTake: 10_000 },
    );

    expect(result).toEqual({ valid: true });
  });

  it("returns invalid when take is negative", () => {
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker:id?take=-1",
    }) as ValidateDataSourceExpressionsResult & { valid: false };

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Param "tickerId": take/limit must be non-negative',
    );
  });

  it("uses custom maxTake in error message", () => {
    const result = validateDataSourceExpressions(
      { x: "db:t:id?take=150" },
      { maxTake: 100 },
    ) as ValidateDataSourceExpressionsResult & { valid: false };

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("max 100"))).toBe(true);
  });
});
