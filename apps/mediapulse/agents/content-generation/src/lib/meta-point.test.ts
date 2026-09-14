import { describe, expect, it } from "vitest";

import { isMetaPoint } from "./meta-point.js";

describe("isMetaPoint", () => {
  it("flags a point reporting that the issuer is absent", () => {
    // Assert
    expect(
      isMetaPoint(
        "PT DCI Indonesia Tbk (DCII) is not mentioned; the coverage is of Arsari Group.",
      ),
    ).toBe(true);
    expect(isMetaPoint("There is no mention of a completion date.")).toBe(true);
    expect(isMetaPoint("DCII is absent from the list of operators.")).toBe(
      true,
    );
  });

  it("flags a point that talks about its own article instead of the news", () => {
    // Assert
    expect(
      isMetaPoint(
        "PT DCI Indonesia Tbk (DCII) is named in the article as a data centre provider.",
      ),
    ).toBe(true);
    expect(
      isMetaPoint(
        "Other conglomerates are detailed, but DCII itself is only referenced by name.",
      ),
    ).toBe(true);
    expect(isMetaPoint("The article does not say when the plant opens.")).toBe(
      true,
    );
  });

  it("keeps an ordinary negative fact the article does state", () => {
    // Assert
    expect(
      isMetaPoint(
        "Hashim Djojohadikusumo said he does not use any AI model himself.",
      ),
    ).toBe(false);
    expect(
      isMetaPoint("DSSA will not pay a dividend for the 2025 financial year."),
    ).toBe(false);
    expect(
      isMetaPoint("The regulator did not approve the tariff increase."),
    ).toBe(false);
    expect(
      isMetaPoint(
        "DCII operates nine data centres in five locations with 132 MW of shell capacity.",
      ),
    ).toBe(false);
  });
});
