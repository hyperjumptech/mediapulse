/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  graphGroupForKind,
  kindLabel,
  sourceLabel,
  truncateTitle,
} from "./knowledge-base-labels";

describe("kindLabel", () => {
  it("names a known kind for a reader", () => {
    expect(kindLabel("regulator")).toBe("Regulator");
  });

  it("prints an unknown kind as stored rather than hiding it", () => {
    expect(kindLabel("syndicate")).toBe("syndicate");
  });
});

describe("sourceLabel", () => {
  it("distinguishes curated input from an article's claim", () => {
    expect(sourceLabel("profile")).toBe("Ticker Profile");
    expect(sourceLabel("extracted")).toBe("Extracted from an article");
  });
});

describe("graphGroupForKind", () => {
  it("colours a brand like a company and a ministry like a regulator", () => {
    expect(graphGroupForKind("brand")).toBe("company");
    expect(graphGroupForKind("government")).toBe("regulator");
  });

  it("falls back to the neutral group for a kind the legend does not name", () => {
    expect(graphGroupForKind("syndicate")).toBe("other");
  });
});

describe("truncateTitle", () => {
  it("leaves a short title alone", () => {
    expect(truncateTitle("Fore opens ten stores")).toBe(
      "Fore opens ten stores",
    );
  });

  it("cuts a long title and marks the cut", () => {
    const cut = truncateTitle("x".repeat(120));

    expect(cut).toHaveLength(80);
    expect(cut.endsWith("…")).toBe(true);
  });
});
