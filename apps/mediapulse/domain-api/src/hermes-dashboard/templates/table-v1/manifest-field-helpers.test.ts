/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  columnsFor,
  previewFieldFor,
  rowFieldKeysFor,
} from "./manifest-field-helpers";

describe("table-v1 > columnsFor", () => {
  it("returns column definitions unchanged", () => {
    // Setup
    type Row = { alpha: string; beta: number };

    // Act
    const columns = columnsFor<Row>()([
      { key: "alpha", label: "Alpha", type: "text" },
    ]);

    // Assert
    expect(columns).toEqual([{ key: "alpha", label: "Alpha", type: "text" }]);
  });
});

describe("table-v1 > rowFieldKeysFor", () => {
  it("returns field key lists unchanged", () => {
    // Setup
    type Row = { sortMe: string; other: number };

    // Act
    const keys = rowFieldKeysFor<Row>()(["sortMe"]);

    // Assert
    expect(keys).toEqual(["sortMe"]);
  });
});

describe("table-v1 > previewFieldFor", () => {
  it("builds an enabled preview for the given field key", () => {
    // Setup
    type Row = { body: string };

    // Act
    const preview = previewFieldFor<Row>()("body");

    // Assert
    expect(preview).toEqual({ enabled: true, fieldKey: "body" });
  });
});
