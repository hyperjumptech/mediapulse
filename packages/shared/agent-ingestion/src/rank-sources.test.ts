import { describe, expect, it } from "vitest";

import { compareSourcesForRanking } from "./rank-sources";

describe("compareSourcesForRanking", () => {
  it("puts the better section fit first regardless of authority", () => {
    // Setup
    const strongFit = { sectionScore: 1, publisherAuthority: 0 };
    const strongAuthority = { sectionScore: 0.6, publisherAuthority: 9.5 };

    // Act
    const result = compareSourcesForRanking(strongFit, strongAuthority);

    // Assert
    expect(result).toBeLessThan(0);
  });

  it("breaks a section-fit tie on publisher authority", () => {
    // Setup
    const lowAuthority = { sectionScore: 0.8, publisherAuthority: 2.1 };
    const highAuthority = { sectionScore: 0.8, publisherAuthority: 8.03 };

    // Act
    const result = compareSourcesForRanking(lowAuthority, highAuthority);

    // Assert
    expect(result).toBeGreaterThan(0);
  });

  it("treats an unknown authority as the lowest possible value", () => {
    // Setup
    const unknown = { sectionScore: 0.8 };
    const weakButKnown = { sectionScore: 0.8, publisherAuthority: 1.2 };

    // Act
    const result = compareSourcesForRanking(unknown, weakButKnown);

    // Assert
    expect(result).toBeGreaterThan(0);
  });

  it("reports a tie when both fit and authority match", () => {
    // Setup
    const first = { sectionScore: 0.8, publisherAuthority: 5 };
    const second = { sectionScore: 0.8, publisherAuthority: 5 };

    // Act
    const result = compareSourcesForRanking(first, second);

    // Assert
    expect(result).toBe(0);
  });

  it("stays transitive when some sources carry no authority", () => {
    // Setup
    const unknown = { sectionScore: 0.8, publisherAuthority: null };
    const middle = { sectionScore: 0.8, publisherAuthority: 2 };
    const top = { sectionScore: 0.8, publisherAuthority: 5 };

    // Act
    const sorted = [middle, unknown, top].sort(compareSourcesForRanking);

    // Assert
    expect(sorted).toEqual([top, middle, unknown]);
  });
});
