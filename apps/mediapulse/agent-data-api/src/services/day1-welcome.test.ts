/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildWelcomeClassification,
  getDay1Welcome,
  type Day1WelcomeDb,
} from "./day1-welcome.js";
import { createInMemoryTickerProfileSource } from "./ticker-profile/ticker-profile-source.js";

const NOW = new Date("2026-10-14T00:00:00.000Z");

const profile = {
  companyOverview: "Telkom runs Indonesia's largest network.",
  businessOperation: "Fixed, mobile and data center services.",
  companyOverviewIndonesian:
    "Telkom mengoperasikan jaringan terbesar di Indonesia.",
  businessOperationIndonesian: "Layanan telepon tetap, seluler dan pusat data.",
  sectorEnglish: "Infrastructures",
  sectorIndonesian: "Infrastruktur",
  subSectorEnglish: "Telecommunication",
  subSectorIndonesian: "Telekomunikasi",
  industryEnglish: "Integrated Telecom",
  industryIndonesian: "Telekomunikasi Terintegrasi",
  subIndustryEnglish: "Fixed and Mobile Network Operators",
  subIndustryIndonesian: "Operator Jaringan Tetap dan Seluler",
  aliases: [],
  competitors: [
    { name: "Indosat", aliases: ["ISAT"] },
    { name: " XL Axiata ", aliases: [] },
    { aliases: ["missing name"] },
  ],
  regulators: [{ name: "Komdigi", aliases: [] }],
};

const dispatchRow = (overrides: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "welcome",
  tickerId: "ticker-1",
  userTickerId: "22222222-2222-4222-8222-222222222222",
  language: "en",
  welcomeSentAt: null,
  userTicker: {
    enabled: true,
    registrationConfirmedAt: new Date("2026-10-13T00:00:00.000Z"),
    user: { email: "reader@example.com", enabled: true },
  },
  ticker: { symbol: "TLKM", name: "Telkom Indonesia" },
  ...overrides,
});

const telkomProfiles = () =>
  vi.fn(createInMemoryTickerProfileSource(new Map([["TLKM", profile]])));

const createDb = (dispatch: unknown) => {
  const findUnique = vi.fn().mockResolvedValue(dispatch);
  const findMany = vi.fn().mockResolvedValue([]);
  const db = {
    day1NewsletterDispatch: { findUnique },
    newsletter: { findMany },
  } as unknown as Day1WelcomeDb;

  return { db, findUnique, findMany };
};

describe("buildWelcomeClassification", () => {
  it("drops blanks and a level that repeats the one above it", () => {
    expect(
      buildWelcomeClassification([
        "Consumer Non-Cyclicals",
        " ",
        "consumer non-cyclicals",
        "Food & Beverage",
        "Snacks",
      ]),
    ).toEqual(["Consumer Non-Cyclicals", "Food & Beverage", "Snacks"]);
  });
});

describe("getDay1Welcome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds an English welcome from the profile", async () => {
    const { db, findMany } = createDb(dispatchRow());
    const profileSource = telkomProfiles();

    const { welcome } = await getDay1Welcome(
      db,
      { dispatchId: "11111111-1111-4111-8111-111111111111" },
      NOW,
      profileSource,
    );

    expect(welcome).toEqual({
      dispatchId: "11111111-1111-4111-8111-111111111111",
      tickerId: "ticker-1",
      userTickerId: "22222222-2222-4222-8222-222222222222",
      language: "en",
      sentAt: null,
      recipient: { email: "reader@example.com" },
      tickerSymbol: "TLKM",
      companyName: "Telkom Indonesia",
      overview: "Telkom runs Indonesia's largest network.",
      businessOperation: "Fixed, mobile and data center services.",
      classification: [
        "Infrastructures",
        "Telecommunication",
        "Integrated Telecom",
      ],
      competitors: ["Indosat", "XL Axiata"],
      regulators: ["Komdigi"],
      recentStories: [],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tickerId: "ticker-1" }),
      }),
    );
    expect(profileSource).toHaveBeenCalledWith(["TLKM"]);
  });

  it("uses the Indonesian classification, overview and business operation for an Indonesian reader", async () => {
    const { db } = createDb(dispatchRow({ language: "id" }));

    const { welcome } = await getDay1Welcome(
      db,
      { dispatchId: "11111111-1111-4111-8111-111111111111" },
      NOW,
      telkomProfiles(),
    );

    expect(welcome).toMatchObject({
      language: "id",
      overview: "Telkom mengoperasikan jaringan terbesar di Indonesia.",
      businessOperation: "Layanan telepon tetap, seluler dan pusat data.",
      classification: [
        "Infrastruktur",
        "Telekomunikasi",
        "Telekomunikasi Terintegrasi",
      ],
    });
  });

  it("still welcomes a ticker without a curated profile", async () => {
    const { db } = createDb(dispatchRow());

    const { welcome } = await getDay1Welcome(
      db,
      { dispatchId: "11111111-1111-4111-8111-111111111111" },
      NOW,
      createInMemoryTickerProfileSource(new Map()),
    );

    expect(welcome).toMatchObject({
      companyName: "Telkom Indonesia",
      overview: null,
      classification: [],
      competitors: [],
      regulators: [],
    });
  });

  it("reports when the welcome was already sent", async () => {
    const { db } = createDb(
      dispatchRow({ welcomeSentAt: new Date("2026-10-13T09:00:00.000Z") }),
    );

    const { welcome } = await getDay1Welcome(
      db,
      { dispatchId: "11111111-1111-4111-8111-111111111111" },
      NOW,
      telkomProfiles(),
    );

    expect(welcome?.sentAt).toBe("2026-10-13T09:00:00.000Z");
  });

  it.each([
    ["the subscription was disabled", { enabled: false }],
    ["the subscription was never confirmed", { registrationConfirmedAt: null }],
    [
      "the user was disabled",
      { user: { email: "reader@example.com", enabled: false } },
    ],
    [
      "the stored email is not deliverable",
      { user: { email: "reader@localhost", enabled: true } },
    ],
  ])("names no recipient when %s", async (_label, userTickerOverrides) => {
    const row = dispatchRow();
    const { db } = createDb({
      ...row,
      userTicker: { ...row.userTicker, ...userTickerOverrides },
    });

    const { welcome } = await getDay1Welcome(
      db,
      { dispatchId: "11111111-1111-4111-8111-111111111111" },
      NOW,
      telkomProfiles(),
    );

    expect(welcome?.recipient).toBeNull();
  });

  it.each([
    ["a missing dispatch", null],
    ["a bootstrap dispatch", dispatchRow({ kind: "bootstrap" })],
    ["a skipped dispatch", dispatchRow({ kind: "none" })],
  ])("returns no welcome for %s", async (_label, dispatch) => {
    const { db, findMany } = createDb(dispatch);
    const profileSource = telkomProfiles();

    const result = await getDay1Welcome(
      db,
      { dispatchId: "11111111-1111-4111-8111-111111111111" },
      NOW,
      profileSource,
    );

    expect(result).toEqual({ welcome: null });
    expect(findMany).not.toHaveBeenCalled();
    expect(profileSource).not.toHaveBeenCalled();
  });
});
