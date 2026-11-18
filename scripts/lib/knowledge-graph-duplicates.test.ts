import { describe, expect, it } from "vitest";

import {
  acronymOf,
  collectInstances,
  coreName,
  findDuplicateCandidates,
  findEventGroups,
  regulationKey,
  smallClasses,
} from "./knowledge-graph-duplicates.mjs";

const MP = "https://mediapulse.hyperjump.tech/ontology#";
const ID = "https://mediapulse.hyperjump.tech/id/";

type Fixture = {
  id: string;
  label: string;
  classes: string[];
  names?: string[];
  ticker?: string;
};

const graphOf = (fixtures: Fixture[]) =>
  collectInstances({
    labelRows: fixtures.flatMap((fixture) =>
      fixture.classes.map((className) => ({
        s: { value: `${ID}${fixture.id}` },
        class: { value: `${MP}${className}` },
        label: { value: fixture.label },
      })),
    ),
    nameRows: fixtures.flatMap((fixture) => [
      ...(fixture.names ?? []).map((name) => ({
        s: { value: `${ID}${fixture.id}` },
        p: { value: "http://purl.org/dc/terms/alternative" },
        name: { value: name },
      })),
      ...(fixture.ticker
        ? [
            {
              s: { value: `${ID}${fixture.id}` },
              p: { value: `${MP}ticker` },
              name: { value: fixture.ticker },
            },
          ]
        : []),
    ]),
  });

const pairsOf = (candidates: ReturnType<typeof findDuplicateCandidates>) =>
  candidates.map(({ a, b }) => [a.label, b.label].sort().join(" = ")).sort();

describe("name helpers", () => {
  it("drops legal words so a company matches its legal name", () => {
    // Act
    const name = coreName("PT Mitra Adiperkasa Tbk.");

    // Assert
    expect(name).toBe("mitra adiperkasa");
  });

  it("builds an acronym from the words that carry meaning", () => {
    // Act
    const acronym = acronymOf("Otoritas Jasa Keuangan");

    // Assert
    expect(acronym).toBe("ojk");
  });

  it("gives a regulation the same key however its number is written", () => {
    // Act
    const short = regulationKey("UU No. 4 Tahun 2023");
    const long = regulationKey("Undang-Undang Nomor 4 Tahun 2023");

    // Assert
    expect(short).toBe("uu 4 2023");
    expect(long).toBe(short);
  });
});

describe("findDuplicateCandidates", () => {
  it("pairs a regulator with its acronym and a government body sharing a label", () => {
    // Arrange
    const instances = graphOf([
      { id: "ojk", label: "OJK", classes: ["Regulator"] },
      {
        id: "ojk-long",
        label: "Otoritas Jasa Keuangan",
        classes: ["Regulator"],
      },
      { id: "bkpm-r", label: "BKPM", classes: ["Regulator"] },
      { id: "bkpm-g", label: "BKPM", classes: ["GovernmentBody"] },
    ]);

    // Act
    const candidates = findDuplicateCandidates({ instances });

    // Assert
    expect(pairsOf(candidates)).toEqual([
      "BKPM = BKPM",
      "OJK = Otoritas Jasa Keuangan",
    ]);
  });

  it("skips an acronym shared by companies that is no one's label", () => {
    // Arrange
    const instances = graphOf([
      {
        id: "a",
        label: "Bumi Suksesindo",
        classes: ["Company"],
        names: ["BSI"],
      },
      {
        id: "b",
        label: "Bhumi Simanggaris Indah",
        classes: ["Company"],
        names: ["BSI"],
      },
      { id: "c", label: "Bridgestone Indonesia", classes: ["Company"] },
      { id: "d", label: "BI", classes: ["Regulator"] },
    ]);

    // Act
    const candidates = findDuplicateCandidates({ instances });

    // Assert
    expect(candidates).toEqual([]);
  });

  it("pairs a company stub with the listed company that carries its name", () => {
    // Arrange
    const instances = graphOf([
      {
        id: "isat",
        label: "Indosat",
        classes: ["ListedCompany"],
        names: ["Indosat Ooredoo"],
        ticker: "ISAT",
      },
      { id: "stub", label: "Indosat Ooredoo", classes: ["Company"] },
    ]);

    // Act
    const candidates = findDuplicateCandidates({ instances });

    // Assert
    expect(pairsOf(candidates)).toEqual(["Indosat = Indosat Ooredoo"]);
    expect(candidates[0]?.reasons).toEqual(["same name: indosat ooredoo"]);
  });

  it("never pairs two listed companies, a brand with a company, or a group with a company", () => {
    // Arrange
    const instances = graphOf([
      {
        id: "adro",
        label: "Alamtri Resources Indonesia",
        classes: ["ListedCompany"],
        names: ["Adaro"],
        ticker: "ADRO",
      },
      {
        id: "aadi",
        label: "Adaro Andalan Indonesia",
        classes: ["ListedCompany"],
        names: ["Adaro"],
        ticker: "AADI",
      },
      { id: "brand", label: "Avian", classes: ["Brand"] },
      { id: "company", label: "Avian", classes: ["Company"] },
      { id: "group", label: "Djarum", classes: ["BusinessGroup"] },
      { id: "djarum", label: "Djarum", classes: ["Company"] },
    ]);

    // Act
    const candidates = findDuplicateCandidates({ instances });

    // Assert
    expect(candidates).toEqual([]);
  });

  it("leaves out pairs already linked as the same or as different things", () => {
    // Arrange
    const instances = graphOf([
      { id: "bi", label: "BI", classes: ["Regulator"] },
      {
        id: "bank",
        label: "Bank Indonesia",
        classes: ["Regulator"],
        names: ["BI"],
      },
      {
        id: "kemen",
        label: "Kemenperin",
        classes: ["Regulator"],
        names: ["Kementerian Perindustrian"],
      },
      {
        id: "kementerian",
        label: "Kementerian Perindustrian",
        classes: ["GovernmentBody"],
      },
      { id: "shopee", label: "Shopee", classes: ["Company"] },
      {
        id: "sea",
        label: "Sea Group",
        classes: ["Company"],
        names: ["Shopee"],
      },
    ]);

    // Act
    const candidates = findDuplicateCandidates({
      instances,
      sameAsPairs: [
        [`${ID}bi`, `${ID}bank`],
        [`${ID}kemen`, `${ID}kementerian`],
      ],
      differentFromPairs: [[`${ID}sea`, `${ID}shopee`]],
    });

    // Assert
    expect(candidates).toEqual([]);
  });

  it("pairs people when the shorter name has at least two words inside the longer", () => {
    // Arrange
    const instances = graphOf([
      { id: "raffi", label: "Raffi Ahmad", classes: ["Person"] },
      { id: "raffi-full", label: "Raffi Farid Ahmad", classes: ["Person"] },
      { id: "solihin", label: "Solihin", classes: ["Person"] },
      {
        id: "solihin-kalla",
        label: "Solihin Jusuf Kalla",
        classes: ["Person"],
      },
    ]);

    // Act
    const candidates = findDuplicateCandidates({ instances });

    // Assert
    expect(pairsOf(candidates)).toEqual(["Raffi Ahmad = Raffi Farid Ahmad"]);
  });

  it("pairs two roles of one person at organizations linked as the same", () => {
    // Arrange
    const instances = graphOf([
      {
        id: "m1",
        label: "Muhammad Sarmuji, Minister at Kemenperin",
        classes: ["Membership"],
      },
      {
        id: "m2",
        label: "Muhammad Sarmuji, Minister at Kementerian Perindustrian",
        classes: ["Membership"],
      },
    ]);

    // Act
    const candidates = findDuplicateCandidates({
      instances,
      sameAsPairs: [[`${ID}kemen`, `${ID}kementerian`]],
      memberships: [
        { iri: `${ID}m1`, member: `${ID}sarmuji`, organization: `${ID}kemen` },
        {
          iri: `${ID}m2`,
          member: `${ID}sarmuji`,
          organization: `${ID}kementerian`,
        },
      ],
    });

    // Assert
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.reasons[0]).toMatch(/^same person and organization/);
  });
});

describe("findEventGroups", () => {
  it("groups one party's deals in one year unless they are already linked", () => {
    // Arrange
    const instances = graphOf([
      {
        id: "ems",
        label: "Era Media Sejahtera",
        classes: ["ListedCompany"],
        ticker: "DOOH",
      },
      {
        id: "rights",
        label: "Era Media Sejahtera rights issue, 2026",
        classes: ["CorporateAction"],
      },
      {
        id: "rights-2",
        label: "Era Media Sejahtera rights issue PMHMETD I, 2026",
        classes: ["CorporateAction"],
      },
      {
        id: "loan",
        label: "Era Media Sejahtera loan, 2026",
        classes: ["CorporateAction"],
      },
      {
        id: "loan-2",
        label: "Era Media Sejahtera shareholder loan facility, 2026",
        classes: ["CorporateAction"],
      },
    ]);

    // Act
    const groups = findEventGroups({
      instances,
      sameAsPairs: [[`${ID}rights`, `${ID}rights-2`]],
    });

    // Assert
    expect(groups).toEqual([
      {
        key: "Era Media Sejahtera, 2026",
        labels: [
          "Era Media Sejahtera loan, 2026",
          "Era Media Sejahtera rights issue PMHMETD I, 2026 (+1 linked)",
          "Era Media Sejahtera shareholder loan facility, 2026",
        ],
      },
    ]);
  });
});

describe("smallClasses", () => {
  it("lists every class with few instances, with their other names", () => {
    // Arrange
    const instances = graphOf([
      {
        id: "jateng",
        label: "Jawa Tengah",
        classes: ["Place"],
        names: ["Central Java"],
      },
      { id: "central", label: "Central Java", classes: ["Place"] },
    ]);

    // Act
    const classes = smallClasses(instances);

    // Assert
    expect(classes).toEqual([
      {
        className: "Place",
        labels: ["Central Java", "Jawa Tengah (Central Java)"],
      },
    ]);
  });
});
