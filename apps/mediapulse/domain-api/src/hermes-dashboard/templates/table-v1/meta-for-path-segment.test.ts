/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { HermesDashboardResource } from "../../paths";
import { buildMetaPayloadForPathSegment } from "./meta-for-path-segment";

describe("table-v1 > buildMetaPayloadForPathSegment", () => {
  it("returns meta for a known path segment", () => {
    // Act
    const meta = buildMetaPayloadForPathSegment(
      HermesDashboardResource.dataSourceExpansions,
    );

    // Assert
    expect(meta).not.toBeNull();
    expect(meta?.title).toBe("Data source expansions");
    expect(meta?.preview).toEqual({
      enabled: true,
      fieldKey: "expansionString",
    });
  });

  it("returns null for an unknown path segment", () => {
    // Act
    const meta = buildMetaPayloadForPathSegment("no-such-resource");

    // Assert
    expect(meta).toBeNull();
  });
});
