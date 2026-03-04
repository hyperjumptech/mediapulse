import { describe, it, expect } from "vitest";

import { metadataToRows } from "./ticker-detail-dialog";

describe("metadataToRows", () => {
  it("returns empty array for null metadata", () => {
    // Act
    const rows = metadataToRows(null);

    // Assert
    expect(rows).toEqual([]);
  });

  it("returns empty array for undefined metadata", () => {
    // Act
    const rows = metadataToRows(undefined);

    // Assert
    expect(rows).toEqual([]);
  });

  it("flattens object metadata into sorted key-value rows", () => {
    // Setup
    const metadata = {
      Sektor: "Energi",
      KodeEmiten: "AADI",
      NamaEmiten: "PT Adaro Andalan Indonesia Tbk",
    };

    // Act
    const rows = metadataToRows(metadata);

    // Assert
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.key)).toEqual([
      "KodeEmiten",
      "NamaEmiten",
      "Sektor",
    ]);
    expect(rows.find((r) => r.key === "KodeEmiten")?.value).toBe("AADI");
    expect(rows.find((r) => r.key === "NamaEmiten")?.value).toBe(
      "PT Adaro Andalan Indonesia Tbk",
    );
    expect(rows.find((r) => r.key === "Sektor")?.value).toBe("Energi");
  });

  it("formats primitive values as strings", () => {
    // Setup
    const metadata = { count: 42, active: true, label: "test" };

    // Act
    const rows = metadataToRows(metadata);

    // Assert
    expect(rows.find((r) => r.key === "count")?.value).toBe("42");
    expect(rows.find((r) => r.key === "active")?.value).toBe("true");
    expect(rows.find((r) => r.key === "label")?.value).toBe("test");
  });

  it("formats null values as em dash", () => {
    // Act
    const rows = metadataToRows({ empty: null });

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("empty");
    expect(rows[0]?.value).toBe("—");
  });

  it("stringifies nested objects with pretty print", () => {
    // Setup
    const metadata = { nested: { a: 1, b: "x" } };

    // Act
    const rows = metadataToRows(metadata);

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("nested");
    expect(rows[0]?.value).toContain('"a": 1');
    expect(rows[0]?.value).toContain('"b": "x"');
  });

  it("includes all keys from metadata including Website", () => {
    // Setup – same shape as IDX import (includes Website)
    const metadata = {
      KodeEmiten: "AADI",
      NamaEmiten: "PT Example Tbk",
      Website: "www.example.com",
      Email: "corsec@example.com",
    };

    // Act
    const rows = metadataToRows(metadata);

    // Assert
    expect(rows).toHaveLength(4);
    const keys = rows.map((r) => r.key).sort();
    expect(keys).toContain("Website");
    expect(keys).toContain("Email");
    expect(keys).toContain("KodeEmiten");
    expect(keys).toContain("NamaEmiten");
    expect(rows.find((r) => r.key === "Website")?.value).toBe(
      "www.example.com",
    );
  });

  it("handles array metadata as single row with stringified value", () => {
    // Act
    const rows = metadataToRows([1, 2, 3]);

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("—");
    expect(rows[0]?.value).toContain("1");
    expect(rows[0]?.value).toContain("2");
    expect(rows[0]?.value).toContain("3");
  });
});
