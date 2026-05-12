import { describe, expect, it } from "vitest";

import config from "./vitest.config";

describe("vitest.config", () => {
  it("runs tests in the node environment", () => {
    expect(config).toMatchObject({ test: { environment: "node" } });
  });
});
