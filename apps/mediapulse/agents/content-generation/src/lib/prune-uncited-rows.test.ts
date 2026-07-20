import { describe, expect, it } from "vitest";

import type {
  NewsletterArticle,
  NewsletterDocument,
  NewsletterSectionKey,
} from "@workspace/email-templates/newsletter-document";

import {
  dedupeWithinRun,
  pruneNewsletterToCitedRows,
} from "./prune-uncited-rows.js";

const CITED_URL_A = "https://source.example/a";
const CITED_URL_B = "https://source.example/b";

/**
 * An article whose grounded URL is empty. `resolveNewsletterDraft` drops these before the prune
 * pass runs, so this is the shape the prune pass's uncited branch still guards against.
 */
const uncited = (title: string): NewsletterArticle => ({
  title,
  url: "",
  points: [title],
});

const article = (
  title: string,
  url: string,
  points: string[] = [title],
): NewsletterArticle => ({ title, url, points });

const document = (
  sections: Array<{ key: NewsletterSectionKey; articles: NewsletterArticle[] }>,
): NewsletterDocument => ({ version: 1, sections });

const sectionOf = (result: NewsletterDocument, key: string) =>
  result.sections.find((section) => section.key === key);

describe("pruneNewsletterToCitedRows — uncited rows dropped", () => {
  it("keeps cited articles and drops uncited ones; counts removedBullets correctly", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [
          article("Cited A", CITED_URL_A),
          uncited("No citation"),
          article("Cited B", CITED_URL_B),
        ],
      },
    ]);

    const {
      document: pruned,
      reports,
      summary,
    } = pruneNewsletterToCitedRows(input);
    const section = sectionOf(pruned, "competitive-landscape");

    expect(section?.articles).toHaveLength(2);
    expect(section?.articles[0]?.title).toBe("Cited A");
    expect(section?.articles[1]?.title).toBe("Cited B");

    const report = reports.find(
      (entry) => entry.sectionKey === "competitive-landscape",
    );

    expect(report?.removedBullets).toBe(1);
    expect(report?.sectionRemoved).toBe(false);
    expect(summary.bulletsRemovedUncited).toBe(1);
    expect(summary.bulletsRemovedDuplicate).toBe(0);
    expect(summary.sectionsKept).toBe(1);
    expect(summary.sectionsRemoved).toBe(0);
  });

  it("treats an article with an empty url as uncited", () => {
    const input = document([
      {
        key: "deals-and-movements",
        articles: [article("Good deal", CITED_URL_A), uncited("Bad index")],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input);

    expect(sectionOf(pruned, "deals-and-movements")?.articles).toHaveLength(1);
    expect(summary.bulletsRemovedUncited).toBe(1);
  });

  it("quick-hits without url are dropped; articles with url are kept", () => {
    const input = document([
      {
        key: "quick-hits",
        articles: [
          article("Cited", CITED_URL_A),
          uncited("Uncited"),
          article("Cited too", CITED_URL_B),
        ],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input);

    expect(sectionOf(pruned, "quick-hits")?.articles).toHaveLength(2);
    expect(summary.bulletsRemovedUncited).toBe(1);
  });
});

describe("pruneNewsletterToCitedRows — duplicate article dedup", () => {
  it("keeps first article per URL within a section, drops later duplicates", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [
          article("First cite A", CITED_URL_A),
          article("Second cite A", CITED_URL_A),
          article("First cite B", CITED_URL_B),
        ],
      },
    ]);

    const {
      document: pruned,
      reports,
      summary,
    } = pruneNewsletterToCitedRows(input);
    const section = sectionOf(pruned, "competitive-landscape");

    expect(section?.articles).toHaveLength(2);
    expect(section?.articles[0]?.title).toBe("First cite A");
    expect(section?.articles[1]?.title).toBe("First cite B");

    const report = reports.find(
      (entry) => entry.sectionKey === "competitive-landscape",
    );

    expect(report?.removedForDuplicate).toBe(1);
    expect(summary.bulletsRemovedDuplicate).toBe(1);
    expect(summary.bulletsRemovedUncited).toBe(0);
  });

  it("dedupeScope 'section' isolates dedup per section — same URL allowed in different sections", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [article("CL article", CITED_URL_A)],
      },
      {
        key: "deals-and-movements",
        articles: [article("Deals article", CITED_URL_A)],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input, {
      dedupeScope: "section",
    });

    expect(sectionOf(pruned, "competitive-landscape")?.articles).toHaveLength(
      1,
    );
    expect(sectionOf(pruned, "deals-and-movements")?.articles).toHaveLength(1);
    expect(summary.bulletsRemovedDuplicate).toBe(0);
  });

  it("dedupeScope 'newsletter' drops a later section article reusing an article from a prior section", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [article("CL article", CITED_URL_A)],
      },
      {
        key: "deals-and-movements",
        articles: [
          article("Deals article citing same article", CITED_URL_A),
          article("Deals article citing new article", CITED_URL_B),
        ],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input, {
      dedupeScope: "newsletter",
    });
    const deals = sectionOf(pruned, "deals-and-movements");

    expect(sectionOf(pruned, "competitive-landscape")?.articles).toHaveLength(
      1,
    );
    expect(deals?.articles).toHaveLength(1);
    expect(deals?.articles[0]?.title).toBe("Deals article citing new article");
    expect(summary.bulletsRemovedDuplicate).toBe(1);
  });

  it("dedupeArticlesWithinSection false disables dedup entirely", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [
          article("First", CITED_URL_A),
          article("Duplicate", CITED_URL_A),
        ],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input, {
      dedupeArticlesWithinSection: false,
    });

    expect(sectionOf(pruned, "competitive-landscape")?.articles).toHaveLength(
      2,
    );
    expect(summary.bulletsRemovedDuplicate).toBe(0);
  });
});

describe("pruneNewsletterToCitedRows — section removal", () => {
  it("removes a section when all its articles are uncited", () => {
    const input = document([
      {
        key: "regulatory-policy-watch",
        articles: [uncited("Uncited article")],
      },
    ]);

    const {
      document: pruned,
      reports,
      summary,
    } = pruneNewsletterToCitedRows(input);

    expect(sectionOf(pruned, "regulatory-policy-watch")).toBeUndefined();

    const report = reports.find(
      (entry) => entry.sectionKey === "regulatory-policy-watch",
    );

    expect(report?.sectionRemoved).toBe(true);
    expect(report?.removedBullets).toBe(1);
    expect(summary.sectionsRemoved).toBe(1);
    expect(summary.sectionsKept).toBe(0);
  });

  it("keeps a section with exactly one cited article (the min-one floor)", () => {
    const input = document([
      {
        key: "deals-and-movements",
        articles: [article("One good deal", CITED_URL_A)],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input);

    expect(sectionOf(pruned, "deals-and-movements")?.articles).toHaveLength(1);
    expect(summary.sectionsRemoved).toBe(0);
    expect(summary.sectionsKept).toBe(1);
  });

  it("removes disruptors-or-tech when all its articles are uncited", () => {
    const input = document([
      { key: "disruptors-or-tech", articles: [uncited("Uncited tech")] },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input);

    expect(sectionOf(pruned, "disruptors-or-tech")).toBeUndefined();
    expect(summary.sectionsRemoved).toBe(1);
  });

  it("removes industry-pulse when uncited and industry-pulse is in sections", () => {
    const input = document([
      { key: "industry-pulse", articles: [uncited("Sector summary")] },
    ]);

    const {
      document: pruned,
      reports,
      summary,
    } = pruneNewsletterToCitedRows(input, { sections: ["industry-pulse"] });

    expect(sectionOf(pruned, "industry-pulse")).toBeUndefined();

    const report = reports.find(
      (entry) => entry.sectionKey === "industry-pulse",
    );

    expect(report?.sectionRemoved).toBe(true);
    expect(summary.sectionsRemoved).toBe(1);
    expect(summary.sectionsKept).toBe(0);
  });

  it("keeps industry-pulse when cited and industry-pulse is in sections", () => {
    const input = document([
      {
        key: "industry-pulse",
        articles: [article("Sector summary", CITED_URL_A)],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input, {
      sections: ["industry-pulse"],
    });

    expect(sectionOf(pruned, "industry-pulse")?.articles[0]?.url).toBe(
      CITED_URL_A,
    );
    expect(summary.sectionsKept).toBe(1);
    expect(summary.sectionsRemoved).toBe(0);
  });

  it("skips sections not in the configured sections list", () => {
    const input = document([
      { key: "competitive-landscape", articles: [uncited("Uncited CL")] },
      { key: "deals-and-movements", articles: [uncited("Uncited deals")] },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input, {
      sections: ["deals-and-movements"],
    });

    // competitive-landscape was not in scope — passes through unchanged
    expect(sectionOf(pruned, "competitive-landscape")?.articles).toHaveLength(
      1,
    );
    // deals-and-movements was in scope and had no cited rows — removed
    expect(sectionOf(pruned, "deals-and-movements")).toBeUndefined();
    expect(summary.sectionsRemoved).toBe(1);
  });

  it("removes quick-hits section when all articles are uncited", () => {
    const input = document([
      {
        key: "quick-hits",
        articles: [uncited("No url"), uncited("Also no url")],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input);

    expect(sectionOf(pruned, "quick-hits")).toBeUndefined();
    expect(summary.sectionsRemoved).toBe(1);
  });

  it("produces correct aggregate summary across multiple sections", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [article("Cited", CITED_URL_A), uncited("Uncited")],
      },
      { key: "deals-and-movements", articles: [uncited("Uncited only")] },
      {
        key: "quick-hits",
        articles: [
          article("Cited A", CITED_URL_A),
          article("Cited A dup", CITED_URL_A),
          article("Cited B", CITED_URL_B),
        ],
      },
    ]);

    const { summary } = pruneNewsletterToCitedRows(input);

    expect(summary.bulletsRemovedUncited).toBe(2);
    expect(summary.bulletsRemovedDuplicate).toBe(1);
    expect(summary.sectionsRemoved).toBe(1);
    expect(summary.sectionsKept).toBe(2);
  });

  it("drops articles with duplicate normalized titles across sections", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [
          article("Rival A Launches", CITED_URL_A, ["Rival A launched."]),
          article("Market Share Grows", CITED_URL_B, ["Market share grew."]),
        ],
      },
      {
        key: "deals-and-movements",
        articles: [
          article("Rival A launches.", CITED_URL_B, ["Rival A deal."]),
        ],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input);

    expect(sectionOf(pruned, "competitive-landscape")?.articles).toHaveLength(
      2,
    );
    expect(sectionOf(pruned, "deals-and-movements")).toBeUndefined();
    expect(summary.bulletsRemovedDuplicateTitle).toBe(1);
  });

  it("dedupeTitlesWithinNewsletter false skips title dedup", () => {
    const input = document([
      {
        key: "competitive-landscape",
        articles: [
          article("Same Title", CITED_URL_A, ["First."]),
          article("Same Title", CITED_URL_B, ["Second."]),
        ],
      },
    ]);

    const { document: pruned, summary } = pruneNewsletterToCitedRows(input, {
      dedupeTitlesWithinNewsletter: false,
    });

    expect(sectionOf(pruned, "competitive-landscape")?.articles).toHaveLength(
      2,
    );
    expect(summary.bulletsRemovedDuplicateTitle).toBe(0);
  });
});

describe("dedupeWithinRun — reworded near-duplicate titles", () => {
  it("drops a second article whose title is a reworded headline of the same event", () => {
    const input = document([
      {
        key: "quick-hits",
        articles: [
          article(
            "Telkomsel hadirkan tiga site baru di Kabupaten Kupang",
            "https://source.example/antara",
            ["Operator memperluas cakupan layanan di wilayah timur."],
          ),
          article(
            "Telkomsel Perkuat Jaringan, Tiga Site Baru Hadir di Kabupaten Kupang",
            "https://source.example/pancar",
            [
              "Perusahaan menambah infrastruktur untuk mendukung pengguna lokal.",
            ],
          ),
        ],
      },
    ]);

    const result = dedupeWithinRun(input);

    expect(result.removedCount).toBe(1);
    expect(sectionOf(result.document, "quick-hits")?.articles).toHaveLength(1);
  });

  it("keeps two distinct stories that share only a few title tokens", () => {
    const input = document([
      {
        key: "quick-hits",
        articles: [
          article(
            "Telkomsel raih tiga penghargaan AI global",
            "https://source.example/awards",
            ["Perusahaan diakui atas inovasi kecerdasan buatan."],
          ),
          article(
            "Telkom tuntaskan streamlining sepuluh entitas",
            "https://source.example/streamline",
            ["Restrukturisasi mempercepat transformasi bisnis."],
          ),
        ],
      },
    ]);

    const result = dedupeWithinRun(input);

    expect(result.removedCount).toBe(0);
    expect(sectionOf(result.document, "quick-hits")?.articles).toHaveLength(2);
  });
});
