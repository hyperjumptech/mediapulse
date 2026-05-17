import { describe, expect, it } from "vitest";

import { deriveRecipientStatus } from "./derive-recipient-status";

describe("deriveRecipientStatus", () => {
  it("returns delivered with inconsistent=false when a checkpoint exists", () => {
    const result = deriveRecipientStatus({
      hasCheckpoint: true,
      latestOutcomeStatus: null,
    });

    expect(result).toStrictEqual({ status: "delivered", inconsistent: false });
  });

  it("ignores outcome status when a checkpoint exists", () => {
    const result = deriveRecipientStatus({
      hasCheckpoint: true,
      latestOutcomeStatus: "failed",
    });

    expect(result).toStrictEqual({ status: "delivered", inconsistent: false });
  });

  it("returns failed when no checkpoint and latest outcome is failed", () => {
    const result = deriveRecipientStatus({
      hasCheckpoint: false,
      latestOutcomeStatus: "failed",
    });

    expect(result).toStrictEqual({ status: "failed", inconsistent: false });
  });

  it("returns skipped when no checkpoint and latest outcome is skipped", () => {
    const result = deriveRecipientStatus({
      hasCheckpoint: false,
      latestOutcomeStatus: "skipped",
    });

    expect(result).toStrictEqual({ status: "skipped", inconsistent: false });
  });

  it("returns delivered + inconsistent when outcome is success but no checkpoint", () => {
    const result = deriveRecipientStatus({
      hasCheckpoint: false,
      latestOutcomeStatus: "success",
    });

    expect(result).toStrictEqual({ status: "delivered", inconsistent: true });
  });

  it("returns not_attempted when nothing is present", () => {
    const result = deriveRecipientStatus({
      hasCheckpoint: false,
      latestOutcomeStatus: null,
    });

    expect(result).toStrictEqual({
      status: "not_attempted",
      inconsistent: false,
    });
  });
});
