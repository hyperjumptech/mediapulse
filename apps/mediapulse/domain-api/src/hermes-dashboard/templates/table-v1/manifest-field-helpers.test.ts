import { dashboardPageColumnSchema } from "@hermes/domain-contract";
import { describe, expect, it } from "vitest";
import {
  columnsFor,
  previewFieldFor,
  rowFieldKeysFor,
  yesNoBadgeTones,
} from "./manifest-field-helpers";

describe("table-v1 > columnsFor", () => {
  it("returns column definitions unchanged", () => {
    type Row = { alpha: string; beta: number };

    const columns = columnsFor<Row>()([
      { key: "alpha", label: "Alpha", type: "text" },
    ]);

    expect(columns).toEqual([{ key: "alpha", label: "Alpha", type: "text" }]);
  });

  it("keeps display hints that the column contract accepts", () => {
    type Row = { outcome: string };
    const column = {
      key: "outcome",
      label: "Outcome",
      type: "text",
      format: "badge",
      badgeTones: { success: "success", failed: "failed" },
      hideBelow: "lg",
      mobile: "badge",
      defaultHidden: true,
    } as const;

    const [parsed] = columnsFor<Row>()([column]).map((entry) =>
      dashboardPageColumnSchema.parse(entry),
    );

    expect(parsed).toEqual(column);
  });
});

describe("table-v1 > yesNoBadgeTones", () => {
  it("maps the Yes and No labels to tones the contract accepts", () => {
    const column = dashboardPageColumnSchema.parse({
      key: "enabled",
      label: "Enabled",
      format: "badge",
      badgeTones: yesNoBadgeTones,
    });

    expect(column.badgeTones).toEqual({ Yes: "success", No: "muted" });
  });
});

describe("table-v1 > rowFieldKeysFor", () => {
  it("returns field key lists unchanged", () => {
    type Row = { sortMe: string; other: number };

    const keys = rowFieldKeysFor<Row>()(["sortMe"]);

    expect(keys).toEqual(["sortMe"]);
  });
});

describe("table-v1 > previewFieldFor", () => {
  it("builds an enabled preview for the given field key", () => {
    type Row = { body: string };

    const preview = previewFieldFor<Row>()("body");

    expect(preview).toEqual({ enabled: true, fieldKey: "body" });
  });
});
