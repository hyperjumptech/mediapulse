import { describe, expect, it } from "vitest";

import { pickPublisherName } from "./pick-publisher-name.js";

describe("pickPublisherName", () => {
  it("keeps a manual name over the site name the fetch read", () => {
    const name = pickPublisherName({
      storedName: "KONTAN",
      storedNameSource: "manual",
      fetchedSiteName: "PT. Kontan Grahanusa Mediatama",
    });

    expect(name).toBe("KONTAN");
  });

  it("uses the fetched site name over a name derived from the URL", () => {
    const name = pickPublisherName({
      storedName: "Thejakartapost",
      storedNameSource: "derived",
      fetchedSiteName: "The Jakarta Post",
    });

    expect(name).toBe("The Jakarta Post");
  });

  it("uses the fetched site name over a model or earlier site name, as the reference table will", () => {
    const overModel = pickPublisherName({
      storedName: "Bisnis",
      storedNameSource: "llm",
      fetchedSiteName: "Bisnis.com",
    });
    const overSiteName = pickPublisherName({
      storedName: "Bisnis.com",
      storedNameSource: "site_metadata",
      fetchedSiteName: "Bisnis Indonesia",
    });

    expect(overModel).toBe("Bisnis.com");
    expect(overSiteName).toBe("Bisnis Indonesia");
  });

  it("uses the fetched site name when the domain has no reference row", () => {
    const name = pickPublisherName({
      storedName: "Batampos",
      storedNameSource: null,
      fetchedSiteName: "Batam Pos",
    });

    expect(name).toBe("Batam Pos");
  });

  it("falls back to whichever name exists", () => {
    const storedOnly = pickPublisherName({
      storedName: "Batam Pos",
      storedNameSource: "manual",
      fetchedSiteName: undefined,
    });
    const fetchedOnly = pickPublisherName({
      storedName: undefined,
      storedNameSource: undefined,
      fetchedSiteName: "Batam Pos",
    });

    expect(storedOnly).toBe("Batam Pos");
    expect(fetchedOnly).toBe("Batam Pos");
  });
});
