import { detailBlockGraphPaletteSlotSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";

import {
  describeGraphNode,
  GRAPH_SLOT_COLOR,
  graphZoomLevelFor,
  isGraphEdgeLabelVisible,
  isGraphNodeLabelVisible,
  truncateGraphLabel,
} from "./graph-presentation";

describe("GRAPH_SLOT_COLOR", () => {
  it("maps every palette slot to a theme token", () => {
    for (const slot of detailBlockGraphPaletteSlotSchema.options) {
      expect(GRAPH_SLOT_COLOR[slot]).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
    expect(GRAPH_SLOT_COLOR.accent3).toBe("var(--chart-3)");
  });
});

describe("graphZoomLevelFor", () => {
  it("is compact below 0.7x, detailed from 1.2x and normal between", () => {
    expect(graphZoomLevelFor(0.69)).toBe("compact");
    expect(graphZoomLevelFor(0.7)).toBe("normal");
    expect(graphZoomLevelFor(1.19)).toBe("normal");
    expect(graphZoomLevelFor(1.2)).toBe("detailed");
  });
});

describe("truncateGraphLabel", () => {
  it("keeps a short label and collapses its whitespace", () => {
    expect(truncateGraphLabel("  Contract   delay ")).toBe("Contract delay");
  });

  it("cuts a long label to 24 characters with an ellipsis", () => {
    const truncated = truncateGraphLabel(
      "A very long entity name that keeps going",
    );

    expect(truncated).toBe("A very long entity name…");
    expect(truncated).toHaveLength(24);
  });
});

describe("describeGraphNode", () => {
  it("names the label, group and connection count", () => {
    expect(
      describeGraphNode({ label: "Acme", group: "Company", degree: 3 }),
    ).toBe("Acme, Company, 3 connections");
  });

  it("uses the singular and skips a missing group", () => {
    expect(describeGraphNode({ label: "Acme", degree: 1 })).toBe(
      "Acme, 1 connection",
    );
  });
});

describe("isGraphNodeLabelVisible", () => {
  it("labels the centre and first ring at the fitted zoom and outer rings once zoomed in", () => {
    const visible = (level: "normal" | "detailed", rank: number) =>
      isGraphNodeLabelVisible({
        level,
        emphasis: "normal",
        isFocus: false,
        rank,
      });

    expect(visible("normal", 1)).toBe(true);
    expect(visible("normal", 2)).toBe(false);
    expect(visible("detailed", 2)).toBe(true);
  });

  it("always labels the selection, its neighbours and the focus node", () => {
    const visible = (
      emphasis: "selected" | "neighbour" | "dimmed" | "normal",
      isFocus: boolean,
    ) =>
      isGraphNodeLabelVisible({ level: "compact", emphasis, isFocus, rank: 3 });

    expect(visible("selected", false)).toBe(true);
    expect(visible("neighbour", false)).toBe(true);
    expect(visible("normal", true)).toBe(true);
    expect(visible("normal", false)).toBe(false);
    expect(visible("dimmed", false)).toBe(false);
  });
});

describe("isGraphEdgeLabelVisible", () => {
  it("shows edge labels next to the selection or from 1.2x", () => {
    expect(
      isGraphEdgeLabelVisible({ level: "normal", emphasis: "highlighted" }),
    ).toBe(true);
    expect(
      isGraphEdgeLabelVisible({ level: "detailed", emphasis: "normal" }),
    ).toBe(true);
    expect(
      isGraphEdgeLabelVisible({ level: "normal", emphasis: "normal" }),
    ).toBe(false);
    expect(
      isGraphEdgeLabelVisible({ level: "compact", emphasis: "dimmed" }),
    ).toBe(false);
  });
});
