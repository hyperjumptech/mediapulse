/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { readUploadedFileAsUtf8Text } from "./read-uploaded-file-as-utf8-text";

describe("readUploadedFileAsUtf8Text", () => {
  it("resolves with file text", async () => {
    const file = new File(['{"a":1}'], "x.json", { type: "application/json" });
    await expect(readUploadedFileAsUtf8Text(file)).resolves.toBe('{"a":1}');
  });
});
