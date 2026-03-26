/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import { resolveDataSourceExpansionReferencesInInput } from "./resolve-data-source-expansion-references";

describe("resolveDataSourceExpansionReferencesInInput", () => {
  it("returns input unchanged when no dse tokens exist", async () => {
    // Setup
    const input = { tickerId: "db:ticker:id", take: 10 };
    const db = { findMany: vi.fn() };

    // Act
    const result = await resolveDataSourceExpansionReferencesInInput(
      input,
      "di-1",
      db,
    );

    // Assert
    expect(result).toEqual(input);
    expect(db.findMany).not.toHaveBeenCalled();
  });

  it("replaces dse tokens with expansion strings", async () => {
    // Setup
    const db = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "tpl-1", expansionString: "db:ticker:id" }]),
    };

    // Act
    const result = await resolveDataSourceExpansionReferencesInInput(
      { tickerId: "{{dse:tpl-1}}" },
      "di-1",
      db,
    );

    // Assert
    expect(db.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          domainIntegrationId: "di-1",
          id: { in: ["tpl-1"] },
        },
      }),
    );
    expect(result).toEqual({ tickerId: "db:ticker:id" });
  });

  it("throws when any dse id is missing", async () => {
    // Setup
    const db = { findMany: vi.fn().mockResolvedValue([]) };

    // Act & Assert
    await expect(
      resolveDataSourceExpansionReferencesInInput(
        { tickerId: "{{dse:missing}}" },
        "di-1",
        db,
      ),
    ).rejects.toThrow(/template not found/i);
  });
});
