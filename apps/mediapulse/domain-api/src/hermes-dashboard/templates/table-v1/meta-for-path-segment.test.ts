import { describe, expect, it } from "vitest";
import { HermesDashboardResource } from "../../paths";
import { buildMetaPayloadForPathSegment } from "./meta-for-path-segment";

describe("table-v1 > buildMetaPayloadForPathSegment", () => {
  it("returns meta for a known path segment", () => {
    const meta = buildMetaPayloadForPathSegment(
      HermesDashboardResource.tickers,
    );

    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("Tickers");
  });

  it("carries column display hints through to the meta payload", () => {
    const meta = buildMetaPayloadForPathSegment(
      HermesDashboardResource.deliveryRuns,
    );
    const outcome = meta?.columns.find((column) => column.key === "outcome");

    expect(outcome).toMatchObject({
      format: "badge",
      mobile: "badge",
      badgeTones: { success: "success", failed: "failed" },
    });
  });

  it("returns null for an unknown path segment", () => {
    const meta = buildMetaPayloadForPathSegment("no-such-resource");

    expect(meta).toBeNull();
  });
});
