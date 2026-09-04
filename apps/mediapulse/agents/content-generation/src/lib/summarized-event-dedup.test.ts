/** @vitest-environment node */

import { describe, expect, it } from "vitest";

import { findSummarizedEventMatch } from "./summarized-event-dedup";

const event = (title: string, points: string[] = ["A point."]) => ({
  title,
  points,
});

describe("findSummarizedEventMatch", () => {
  it("matches two summaries of one story whose sources were in different languages", () => {
    const kept = [event("OJK: Indonesia's On-Chain Economy Coming Soon")];

    const match = findSummarizedEventMatch(
      event("OJK: Indonesia’s ‘On-Chain Economy’ is Coming"),
      kept,
    );

    expect(match).toBe(0);
  });

  it("matches two outlets reporting one launch", () => {
    const kept = [
      event(
        "BRI Officially Launches BRImo Taiwan: A Digital Financial Service Bridge for Indonesian Diaspora and Migrant Workers",
      ),
    ];

    const match = findSummarizedEventMatch(
      event(
        "BRI Launches BRImo Taiwan, Strengthens Financial Access for Indonesian Diaspora",
      ),
      kept,
    );

    expect(match).toBe(0);
  });

  it("leaves two different stories about one company alone", () => {
    const kept = [event("Telkomsel Books Rp 10.4 Trillion Profit")];

    const match = findSummarizedEventMatch(
      event("Telkomsel's CEO Reveals AI Transformation Strategy"),
      kept,
    );

    expect(match).toBeUndefined();
  });

  it("leaves two regulatory stories from one regulator alone", () => {
    const kept = [
      event("BPOM Supports Reusable Packaging as a Waste Solution"),
    ];

    const match = findSummarizedEventMatch(
      event("BPOM Tightens BPA Migration Limits on Food Packaging"),
      kept,
    );

    expect(match).toBeUndefined();
  });

  it("returns undefined for a heading with no distinctive anchors", () => {
    expect(findSummarizedEventMatch(event("Up 2%"), [event("Up 2%")])).toBe(
      undefined,
    );
  });

  it("returns undefined when nothing has been kept yet", () => {
    expect(findSummarizedEventMatch(event("Some Long Headline Here"), [])).toBe(
      undefined,
    );
  });
});
