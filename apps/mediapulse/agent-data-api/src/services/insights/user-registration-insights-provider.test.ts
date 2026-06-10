import { describe, it, expect } from "vitest";
import { insightsPayloadSchema } from "@workspace/agent-data-api-contract";
import { createUserRegistrationInsightsProvider } from "./user-registration-insights-provider.js";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const now = new Date();
const windowStart = new Date(now.getTime() - WINDOW_MS);
const priorStart = new Date(windowStart.getTime() - WINDOW_MS);

function makeDate(base: Date, offsetMs: number): Date {
  return new Date(base.getTime() + offsetMs);
}

function makeUser(offsetMs: number) {
  return { createdAt: new Date(now.getTime() - offsetMs) };
}

function makeTicker(
  id: string,
  overrides: Partial<{
    tickerId: string;
    userId: string;
    enabled: boolean;
    createdAt: Date;
    registrationConfirmedAt: Date | null;
    unsubscribedAt: Date | null;
    unsubscribeMethod: string | null;
    symbol: string;
  }> = {},
) {
  return {
    id,
    tickerId: overrides.tickerId ?? "ticker-aapl",
    userId: overrides.userId ?? "user-1",
    enabled: overrides.enabled ?? true,
    createdAt: overrides.createdAt ?? makeDate(windowStart, 3600 * 1000),
    registrationConfirmedAt: overrides.registrationConfirmedAt ?? null,
    unsubscribedAt: overrides.unsubscribedAt ?? null,
    unsubscribeMethod: overrides.unsubscribeMethod ?? null,
    ticker: { symbol: overrides.symbol ?? "AAPL" },
  };
}

function makeConfirmedActive(id: string, symbol = "AAPL") {
  return makeTicker(id, {
    registrationConfirmedAt: makeDate(windowStart, 3600 * 1000 * 2),
    enabled: true,
    symbol,
  });
}

function makeUnsubscribed(id: string, method: string | null = "link") {
  return makeTicker(id, {
    registrationConfirmedAt: makeDate(windowStart, 3600 * 1000 * 2),
    unsubscribedAt: makeDate(windowStart, 3600 * 1000 * 4),
    unsubscribeMethod: method,
    enabled: false,
  });
}

function makeDeps(
  users: { createdAt: Date }[],
  byCreatedAt: ReturnType<typeof makeTicker>[],
  byConfirmedAt: ReturnType<typeof makeTicker>[],
  byUnsubscribedAt: ReturnType<typeof makeTicker>[],
  active: ReturnType<typeof makeTicker>[],
) {
  const callCounts = { confirmed: 0, unsubscribed: 0, active: 0, created: 0 };
  return {
    deps: {
      mediapulseUser: { findMany: async () => users },
      userTicker: {
        findMany: async (args: {
          where: {
            createdAt?: { gte: Date };
            registrationConfirmedAt?: { gte: Date };
            unsubscribedAt?: { gte: Date } | null;
            enabled?: boolean;
          };
        }) => {
          if (
            args.where.enabled === true &&
            args.where.unsubscribedAt === null
          ) {
            callCounts.active += 1;
            return active;
          }
          if (args.where.registrationConfirmedAt) {
            callCounts.confirmed += 1;
            return byConfirmedAt;
          }
          if (
            args.where.unsubscribedAt &&
            typeof args.where.unsubscribedAt === "object" &&
            "gte" in args.where.unsubscribedAt
          ) {
            callCounts.unsubscribed += 1;
            return byUnsubscribedAt;
          }
          callCounts.created += 1;
          return byCreatedAt;
        },
      },
    },
    callCounts,
  };
}

describe("createUserRegistrationInsightsProvider", () => {
  it("produces a payload that validates against insightsPayloadSchema", async () => {
    const confirmed = makeConfirmedActive("ut-1");
    const { deps } = makeDeps(
      [makeUser(3600 * 1000)],
      [confirmed],
      [confirmed],
      [],
      [confirmed],
    );
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    expect(() => insightsPayloadSchema.parse(payload)).not.toThrow();
    expect(payload.agentId).toBe("user-registration");
  });

  it("funnel stages are monotonically non-increasing in a healthy scenario", async () => {
    const rows = [
      makeConfirmedActive("ut-1"),
      makeConfirmedActive("ut-2"),
      makeTicker("ut-3"),
    ];
    const { deps } = makeDeps(
      [makeUser(1000)],
      rows,
      rows.slice(0, 2),
      [],
      rows.slice(0, 2),
    );
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    const funnel = payload.sections.find(
      (s) => s.id === "what-lifecycle-funnel",
    );
    expect(funnel?.widget.kind).toBe("funnel");
    if (funnel?.widget.kind === "funnel") {
      const values = funnel.widget.stages.map((s) => s.value);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeLessThanOrEqual(values[i - 1]!);
      }
    }
  });

  it("status breakdown fractions sum to 1", async () => {
    const rows = [
      makeConfirmedActive("ut-1"),
      makeTicker("ut-2"),
      makeUnsubscribed("ut-3"),
    ];
    const { deps } = makeDeps(
      [],
      rows,
      [],
      rows.filter((r) => r.unsubscribedAt !== null),
      [],
    );
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    const whoSection = payload.sections.find(
      (s) => s.id === "who-status-breakdown",
    );
    expect(whoSection?.widget.kind).toBe("breakdown");
    if (whoSection?.widget.kind === "breakdown") {
      const total = whoSection.widget.slices.reduce(
        (sum, s) => sum + s.fraction,
        0,
      );
      expect(total).toBeCloseTo(1, 5);
    }
  });

  it("unsubscribe-method breakdown excludes null-method rows", async () => {
    const withMethod = makeUnsubscribed("ut-1", "link");
    const withOneClick = makeUnsubscribed("ut-2", "one_click");
    const adminDisable = makeUnsubscribed("ut-3", null);
    const { deps } = makeDeps(
      [],
      [],
      [],
      [withMethod, withOneClick, adminDisable],
      [],
    );
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    const whySection = payload.sections.find(
      (s) => s.id === "why-unsubscribe-method",
    );
    expect(whySection?.widget.kind).toBe("breakdown");
    if (whySection?.widget.kind === "breakdown") {
      const total = whySection.widget.slices.reduce(
        (sum, s) => sum + s.value,
        0,
      );
      expect(total).toBe(2);
      expect(whySection.widget.slices.every((s) => s.label !== null)).toBe(
        true,
      );
    }
  });

  it("confirmation rate = confirmed / new subscriptions in window", async () => {
    const newSubs = [
      makeConfirmedActive("ut-1"),
      makeConfirmedActive("ut-2"),
      makeTicker("ut-3"),
    ];
    const { deps } = makeDeps(
      [],
      newSubs,
      newSubs.filter((r) => r.registrationConfirmedAt !== null),
      [],
      [],
    );
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    const rateKpi = payload.kpis.find((k) => k.id === "confirmation_rate");
    expect(rateKpi?.value).toBe(67);
  });

  it("KPI delta reflects prior-window comparison", async () => {
    const currentSub = makeTicker("ut-current", {
      createdAt: makeDate(windowStart, 3600 * 1000),
    });
    const priorSub = makeTicker("ut-prior", {
      createdAt: makeDate(priorStart, 3600 * 1000),
    });

    const { deps } = makeDeps([], [currentSub, priorSub], [], [], []);
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    const subsKpi = payload.kpis.find((k) => k.id === "new_subscriptions");
    expect(subsKpi?.value).toBe(1);
    expect(subsKpi?.delta).toBe(0);
  });

  it("top-N capping for per-ticker active subscribers", async () => {
    const manyTickers = Array.from({ length: 15 }, (_, i) =>
      makeTicker(`ut-${i}`, {
        tickerId: `ticker-${i}`,
        symbol: `TKR${i}`,
        enabled: true,
        registrationConfirmedAt: makeDate(windowStart, 1000),
      }),
    );
    const { deps } = makeDeps([], [], [], [], manyTickers);
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    const whereSection = payload.sections.find(
      (s) => s.id === "where-per-ticker",
    );
    expect(whereSection?.widget.kind).toBe("categoryBar");
    if (whereSection?.widget.kind === "categoryBar") {
      expect(whereSection.widget.bars.length).toBeLessThanOrEqual(11);
      const otherBar = whereSection.widget.bars.find(
        (b) => b.label === "Other",
      );
      expect(otherBar).toBeDefined();
    }
  });

  it("confirmation-rate-drop alert fires when rate drops >20pp vs prior window", async () => {
    const currentSubs = [
      makeTicker("ut-c1"),
      makeTicker("ut-c2"),
      makeTicker("ut-c3"),
    ];
    const priorSubs = [
      makeConfirmedActive("ut-p1"),
      makeConfirmedActive("ut-p2"),
    ].map((r) => ({
      ...r,
      createdAt: makeDate(priorStart, 3600 * 1000),
    }));

    const { deps } = makeDeps([], [...currentSubs, ...priorSubs], [], [], []);
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    const alert = payload.alerts.find((a) => a.id === "confirmation-rate-drop");
    expect(alert).toBeDefined();
    expect(alert?.severity).toBe("warning");
  });

  it("produces a valid empty payload when no data exists", async () => {
    const { deps } = makeDeps([], [], [], [], []);
    const provider = createUserRegistrationInsightsProvider(deps);
    const payload = await provider.compute({ window: "7d" });

    expect(() => insightsPayloadSchema.parse(payload)).not.toThrow();
    expect(payload.kpis.find((k) => k.id === "new_subscriptions")?.value).toBe(
      0,
    );
    expect(
      payload.sections.find((s) => s.id === "where-per-ticker"),
    ).toBeUndefined();
    expect(
      payload.sections.find((s) => s.id === "why-unsubscribe-method"),
    ).toBeUndefined();
  });
});
