/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";

import {
  importTickerProfilesFromRequestBody,
  type TickerProfileUpsertDb,
} from "./import-ticker-profiles-json";

const validRow = {
  symbol: "AADI",
  name: "Adaro Andalan Indonesia",
  aliases: ["AADI", "Adaro Andalan"],
  company_overview: "Thermal coal producer spun off from Adaro Energy.",
  business_operation: "Mines and sells thermal coal to PLN and export markets.",
  sector: { id: "Energi", en: "Energy" },
  sub_sector: { id: "Batu Bara", en: "Coal" },
  industry: { id: "Batu Bara Termal", en: "Thermal Coal" },
  sub_industry: {
    id: "Penambangan Batu Bara Termal",
    en: "Thermal Coal Mining",
  },
  competitors: [{ name: "Indo Tambangraya Megah", aliases: ["ITMG"] }],
  regulators: [{ name: "Kementerian ESDM", aliases: ["ESDM"] }],
};

const createDb = (
  tickerId: string | null,
  existingProfileId: string | null,
): TickerProfileUpsertDb =>
  ({
    ticker: {
      findUnique: vi
        .fn()
        .mockResolvedValue(tickerId === null ? null : { id: tickerId }),
    },
    tickerProfile: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          existingProfileId === null ? null : { id: existingProfileId },
        ),
      upsert: vi.fn().mockResolvedValue({ id: "profile-1" }),
    },
  }) as unknown as TickerProfileUpsertDb;

describe("importTickerProfilesFromRequestBody", () => {
  it("returns 400 when body is not an object with payloadJson", async () => {
    const result = await importTickerProfilesFromRequestBody(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.message).toBe("Invalid request body");
    }
  });

  it("returns 400 when payloadJson is not valid JSON", async () => {
    const result = await importTickerProfilesFromRequestBody({
      payloadJson: "{",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Invalid JSON");
    }
  });

  it("returns 400 when a row is missing a classification level", async () => {
    const incomplete: Record<string, unknown> = { ...validRow };
    delete incomplete.sub_industry;
    const result = await importTickerProfilesFromRequestBody({
      payloadJson: JSON.stringify([incomplete]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Invalid ticker profile payload");
    }
  });

  it("creates a profile and maps both language sides", async () => {
    const db = createDb("ticker-1", null);

    const result = await importTickerProfilesFromRequestBody(
      { payloadJson: JSON.stringify([validRow]) },
      { db },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.skipped).toEqual([]);
    }

    const upsertArgs = vi.mocked(db.tickerProfile.upsert).mock.calls[0]?.[0];

    expect(upsertArgs?.where).toEqual({ tickerId: "ticker-1" });
    expect(upsertArgs?.update.sectorIndonesian).toBe("Energi");
    expect(upsertArgs?.update.sectorEnglish).toBe("Energy");
    expect(upsertArgs?.update.subIndustryIndonesian).toBe(
      "Penambangan Batu Bara Termal",
    );
    expect(upsertArgs?.update.subIndustryEnglish).toBe("Thermal Coal Mining");
    expect(upsertArgs?.update.competitors).toEqual([
      { name: "Indo Tambangraya Megah", aliases: ["ITMG"] },
    ]);
  });

  it("counts an existing profile as updated", async () => {
    const db = createDb("ticker-1", "profile-1");

    const result = await importTickerProfilesFromRequestBody(
      { payloadJson: JSON.stringify([validRow]) },
      { db },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toBe(0);
      expect(result.updated).toBe(1);
    }
  });

  it("skips rows whose symbol has no ticker", async () => {
    const db = createDb(null, null);

    const result = await importTickerProfilesFromRequestBody(
      { payloadJson: JSON.stringify([validRow]) },
      { db },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toBe(0);
      expect(result.skipped).toEqual(["AADI"]);
    }
    expect(db.tickerProfile.upsert).not.toHaveBeenCalled();
  });

  it("accepts a payload wrapped in a data array", async () => {
    const db = createDb("ticker-1", null);

    const result = await importTickerProfilesFromRequestBody(
      { payloadJson: JSON.stringify({ data: [validRow] }) },
      { db },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.added).toBe(1);
    }
  });
});
