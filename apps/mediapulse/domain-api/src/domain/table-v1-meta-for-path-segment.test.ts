/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { HermesDashboardResource } from "./hermes-dashboard-paths";
import { buildTableV1MetaPayloadForPathSegment } from "./table-v1-meta-for-path-segment";

describe("buildTableV1MetaPayloadForPathSegment", () => {
  it("returns meta for a known path segment", () => {
    // Act
    const meta = buildTableV1MetaPayloadForPathSegment(
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
    const meta = buildTableV1MetaPayloadForPathSegment("no-such-resource");

    // Assert
    expect(meta).toBeNull();
  });
});
