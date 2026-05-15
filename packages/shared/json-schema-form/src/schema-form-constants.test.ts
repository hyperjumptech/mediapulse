/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { SCHEMA_FORM_NEW_ENTRY_KEY } from "./schema-form-constants";

describe("schema-form-constants", () => {
  it("exposes a stable placeholder key for new record entries", () => {
    expect(SCHEMA_FORM_NEW_ENTRY_KEY).toBe("__new__");
  });
});
