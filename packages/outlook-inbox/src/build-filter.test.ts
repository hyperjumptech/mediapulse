import { describe, expect, it } from "vitest";

import { buildFilter } from "./build-filter.js";
import type { MessageFilter } from "./types.js";

describe("buildFilter", () => {
  it("returns empty string for empty filter", () => {
    // Act
    const result = buildFilter({});

    // Assert
    expect(result).toBe("");
  });

  it("returns empty string when all values are undefined", () => {
    // Act
    const result = buildFilter({
      subjectEquals: undefined,
      subjectContains: undefined,
      receivedAfter: undefined,
      receivedBefore: undefined,
      isUnread: undefined,
    });

    // Assert
    expect(result).toBe("");
  });

  it("builds subjectEquals filter", () => {
    // Act
    const result = buildFilter({ subjectEquals: "Hello" });

    // Assert
    expect(result).toBe("subject eq 'Hello'");
  });

  it("ignores empty subjectEquals", () => {
    // Act
    const result = buildFilter({ subjectEquals: "" });

    // Assert
    expect(result).toBe("");
  });

  it("escapes single quotes in subjectEquals", () => {
    // Act
    const result = buildFilter({ subjectEquals: "It's here" });

    // Assert
    expect(result).toBe("subject eq 'It''s here'");
  });

  it("builds subjectContains filter", () => {
    // Act
    const result = buildFilter({ subjectContains: "invoice" });

    // Assert
    expect(result).toBe("contains(subject,'invoice')");
  });

  it("ignores empty subjectContains", () => {
    // Act
    const result = buildFilter({ subjectContains: "" });

    // Assert
    expect(result).toBe("");
  });

  it("builds receivedAfter filter", () => {
    // Setup
    const d = new Date("2024-01-15T10:00:00.000Z");

    // Act
    const result = buildFilter({ receivedAfter: d });

    // Assert
    expect(result).toBe("receivedDateTime ge 2024-01-15T10:00:00.000Z");
  });

  it("builds receivedBefore filter", () => {
    // Setup
    const d = new Date("2024-06-20T12:30:00.000Z");

    // Act
    const result = buildFilter({ receivedBefore: d });

    // Assert
    expect(result).toBe("receivedDateTime le 2024-06-20T12:30:00.000Z");
  });

  it("builds isUnread true filter", () => {
    // Act
    const result = buildFilter({ isUnread: true });

    // Assert
    expect(result).toBe("isRead eq false");
  });

  it("builds isUnread false filter", () => {
    // Act
    const result = buildFilter({ isUnread: false });

    // Assert
    expect(result).toBe("isRead eq true");
  });

  it("combines multiple criteria with and", () => {
    // Setup
    const filter: MessageFilter = {
      subjectContains: "report",
      receivedAfter: new Date("2024-01-01T00:00:00.000Z"),
      isUnread: true,
    };

    // Act
    const result = buildFilter(filter);

    // Assert
    expect(result).toBe(
      "contains(subject,'report') and receivedDateTime ge 2024-01-01T00:00:00.000Z and isRead eq false",
    );
  });

  it("combines subjectEquals and receivedBefore", () => {
    // Setup
    const d = new Date("2024-12-31T23:59:59.999Z");

    // Act
    const result = buildFilter({ subjectEquals: "Done", receivedBefore: d });

    // Assert
    expect(result).toBe(
      "subject eq 'Done' and receivedDateTime le 2024-12-31T23:59:59.999Z",
    );
  });
});
