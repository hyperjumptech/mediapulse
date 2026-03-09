import { describe, expect, it } from "vitest";

import {
  applySubjectFilter,
  buildFilter,
  buildFilterForGraph,
} from "./build-filter.js";
import type { GraphMessage, MessageFilter } from "./types.js";

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

describe("buildFilterForGraph", () => {
  it("returns empty string for empty filter", () => {
    expect(buildFilterForGraph({})).toBe("");
  });

  it("excludes subjectEquals and subjectContains", () => {
    const filter: MessageFilter = {
      subjectEquals: "Hello",
      subjectContains: "world",
    };
    expect(buildFilterForGraph(filter)).toBe("");
  });

  it("includes only receivedDateTime and isRead", () => {
    const filter: MessageFilter = {
      subjectContains: "ignored",
      receivedAfter: new Date("2024-01-01T00:00:00.000Z"),
      isUnread: true,
    };
    expect(buildFilterForGraph(filter)).toBe(
      "receivedDateTime ge 2024-01-01T00:00:00.000Z and isRead eq false",
    );
  });
});

describe("applySubjectFilter", () => {
  const messages: GraphMessage[] = [
    {
      id: "1",
      subject: "New Registration",
      receivedDateTime: "2024-01-01T00:00:00Z",
      isRead: false,
    },
    {
      id: "2",
      subject: "Other topic",
      receivedDateTime: "2024-01-02T00:00:00Z",
      isRead: false,
    },
    {
      id: "3",
      subject: "New Registration confirmed",
      receivedDateTime: "2024-01-03T00:00:00Z",
      isRead: false,
    },
  ];

  it("returns all messages when no subject filter", () => {
    expect(applySubjectFilter(messages, {})).toHaveLength(3);
    expect(applySubjectFilter(messages, { isUnread: true })).toHaveLength(3);
  });

  it("filters by subjectContains case-insensitively", () => {
    const result = applySubjectFilter(messages, {
      subjectContains: "New Registration",
    });
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id)).toEqual(["1", "3"]);
    expect(
      applySubjectFilter(messages, { subjectContains: "registration" }),
    ).toHaveLength(2);
  });

  it("filters by subjectEquals exact match", () => {
    const result = applySubjectFilter(messages, {
      subjectEquals: "New Registration",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("applies both subjectEquals and subjectContains when present", () => {
    const result = applySubjectFilter(messages, {
      subjectEquals: "New Registration",
      subjectContains: "Registration",
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  it("handles null subject", () => {
    const withNull: GraphMessage[] = [
      {
        id: "x",
        subject: null,
        receivedDateTime: "2024-01-01T00:00:00Z",
        isRead: false,
      },
    ];
    expect(
      applySubjectFilter(withNull, { subjectContains: "foo" }),
    ).toHaveLength(0);
    expect(applySubjectFilter(withNull, {})).toHaveLength(1);
  });
});
