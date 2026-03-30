import { describe, expect, it } from "vitest";
import { mapRowToListItem } from "./list-mapper";
import type { ListRow } from "./list-mapper";

const BASE_DATE = new Date("2026-04-01T10:00:00.000Z");
const SET_DATE = new Date("2026-04-01T05:00:00.000Z");

const baseRow = (overrides: Partial<ListRow> = {}): ListRow =>
  ({
    id: "sq-1",
    text: "AAPL latest news",
    tickerId: "ticker-1",
    setId: "set-1",
    source: "DETERMINISTIC",
    intent: "BREAKING",
    rank: 1,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ticker: { symbol: "AAPL", name: "Apple Inc." },
    set: {
      id: "set-1",
      isActive: true,
      generatedAt: SET_DATE,
      generationSource: "hybrid_v1",
      agentJobId: "job-abc",
    },
    ...overrides,
  }) as ListRow;

describe("mapRowToListItem", () => {
  it("maps all fields for a fully-populated active-set row", () => {
    const item = mapRowToListItem(baseRow());

    expect(item.id).toBe("sq-1");
    expect(item.text).toBe("AAPL latest news");
    expect(item.tickerSymbol).toBe("AAPL");
    expect(item.tickerName).toBe("Apple Inc.");
    expect(item.activeSet).toBe("Yes");
    expect(item.intent).toBe("Breaking");
    expect(item.rank).toBe("1");
    expect(item.source).toBe("Deterministic");
    expect(item.setGeneratedAt).toBe(SET_DATE.toISOString());
    expect(item.generationPipeline).toBe("hybrid_v1");
    expect(item.querySetId).toBe("set-1");
    expect(item.agentJobId).toBe("job-abc");
    expect(item.createdAt).toBe(BASE_DATE.toISOString());
    expect(item.updatedAt).toBe(BASE_DATE.toISOString());
  });

  it("maps LLM source and KG_CHANGE intent labels", () => {
    const item = mapRowToListItem(
      baseRow({ source: "LLM", intent: "KG_CHANGE" }),
    );

    expect(item.source).toBe("LLM");
    expect(item.intent).toBe("KG Change");
  });

  it("maps FUNDAMENTAL intent label", () => {
    const item = mapRowToListItem(baseRow({ intent: "FUNDAMENTAL" }));

    expect(item.intent).toBe("Fundamental");
  });

  it("returns activeSet=No for inactive set", () => {
    const row = baseRow();
    row.set = { ...row.set!, isActive: false };
    const item = mapRowToListItem(row);

    expect(item.activeSet).toBe("No");
  });

  it("returns empty strings and null setGeneratedAt for legacy row without a set", () => {
    const row = baseRow({
      setId: null,
      source: null,
      intent: null,
      rank: null,
    });
    row.set = null;
    const item = mapRowToListItem(row as ListRow);

    expect(item.activeSet).toBe("No");
    expect(item.source).toBe("");
    expect(item.intent).toBe("");
    expect(item.rank).toBe("");
    expect(item.setGeneratedAt).toBeNull();
    expect(item.generationPipeline).toBe("");
    expect(item.querySetId).toBe("");
    expect(item.agentJobId).toBe("");
  });

  it("returns agentJobId as empty string when null in set", () => {
    const row = baseRow();
    row.set = { ...row.set!, agentJobId: null };
    const item = mapRowToListItem(row);

    expect(item.agentJobId).toBe("");
  });
});
