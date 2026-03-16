/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  validateDataSourceExpressions,
  type ValidateDataSourceExpressionsResult,
} from "./validate-data-source-expressions";

describe("validateDataSourceExpressions", () => {
  it("returns valid when no data source strings", () => {
    // Act
    const result = validateDataSourceExpressions({
      tickerId: "literal-id",
      foo: 123,
    });

    // Assert
    expect(result).toEqual({ valid: true });
  });

  it("returns valid when data source string parses and take in bounds", () => {
    // Act
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker:id?take=100",
    });

    // Assert
    expect(result).toEqual({ valid: true });
  });

  it("returns invalid when data source string has bad format", () => {
    // Act
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker",
    }) as ValidateDataSourceExpressionsResult & { valid: false };

    // Assert
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Param "tickerId": invalid data source format. Expected db:table:field?options',
    );
  });

  it("returns invalid when take exceeds MAX_TAKE", () => {
    // Act
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker:id?take=10000",
    }) as ValidateDataSourceExpressionsResult & { valid: false };

    // Assert
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("exceeds max"))).toBe(true);
  });

  it("returns invalid when take is negative", () => {
    // Act
    const result = validateDataSourceExpressions({
      tickerId: "db:ticker:id?take=-1",
    }) as ValidateDataSourceExpressionsResult & { valid: false };

    // Assert
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Param "tickerId": take/limit must be non-negative',
    );
  });
});
