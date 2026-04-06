/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { updateHermesAdminPasswordWithCredentialBump } from "./update-hermes-admin-password";

describe("updateHermesAdminPasswordWithCredentialBump", () => {
  it("updates password and increments credential version", async () => {
    const update = vi.fn().mockResolvedValue({});
    await updateHermesAdminPasswordWithCredentialBump(
      { user: { update } },
      "uid",
      "secret",
      async (p) => `hashed:${p}`,
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "uid" },
      data: {
        password: "hashed:secret",
        credentialVersion: { increment: 1 },
      },
    });
  });
});
