import { describe, expect, it } from "vitest";

import { FOREIGN_EXCHANGE_CODES } from "./foreign-exchange-codes";

describe("FOREIGN_EXCHANGE_CODES", () => {
  it.each(["IDX", "JK", "JKSE", "BEI"])(
    "leaves out the Indonesian code %s, so an IDX ticker is never read as foreign",
    (code) => {
      expect(FOREIGN_EXCHANGE_CODES).not.toContain(code);
    },
  );
});
