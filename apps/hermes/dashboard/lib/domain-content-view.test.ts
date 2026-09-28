/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardView } from "@hermes/domain-contract";

import {
  fetchAgentTabContents,
  fetchDomainContentView,
} from "./domain-content-view";
import type { DomainIntegrationRecord } from "./domain-integrations";

const getDomainIntegrationByIntegrationIdMock = vi.hoisted(() => vi.fn());
const getBearerJwtMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/domain-integrations", () => ({
  getDomainIntegrationByIntegrationId: (...args: unknown[]) =>
    getDomainIntegrationByIntegrationIdMock(...args),
}));

vi.mock("@/lib/domain-integration-auth-token", () => ({
  getBearerJwtForDomainIntegrationId: (...args: unknown[]) =>
    getBearerJwtMock(...args),
  invalidateDomainIntegrationToken: vi.fn(),
}));

type ContentDashboardView = Extract<
  DashboardView,
  { kind: "markdown" | "html" | "text" }
>;

const buildAgentTabView = (
  id: string,
  order: number,
): ContentDashboardView => ({
  id,
  label: id,
  kind: "markdown",
  placement: "agent-tab",
  pathSegment: id,
  apiPrefix: `/v1/tabs/${id}`,
  order,
});

const buildIntegration = (views: DashboardView[]): DomainIntegrationRecord => ({
  id: "di-1",
  integrationId: "mediapulse",
  name: "Mediapulse",
  baseUrl: "http://domain.test/",
  version: "1",
  dashboard: { templateVersion: 1, views },
  capabilities: ["preview-expansion"],
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("fetchAgentTabContents", () => {
  beforeEach(() => {
    getDomainIntegrationByIntegrationIdMock.mockReset();
    getBearerJwtMock.mockReset();
    getBearerJwtMock.mockResolvedValue("jwt");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps loaded tabs when another tab fails", async () => {
    // Setup
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue(
      buildIntegration([
        buildAgentTabView("summary", 0),
        buildAgentTabView("broken", 1),
      ]),
    );
    const fetchMock = vi
      .fn()
      .mockImplementation(async (url: string) =>
        url.includes("/broken")
          ? new Response("boom", { status: 500 })
          : jsonResponse({ body: "# Summary" }),
      );
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const tabs = await fetchAgentTabContents("mediapulse", "agent-1");

    // Assert
    expect(tabs.map((tab) => tab.view.id)).toEqual(["summary"]);
    expect(tabs[0]?.content.body).toBe("# Summary");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Could not load agent tab "broken" from domain integration "mediapulse"',
      expect.any(Error),
    );
  });

  it("rejects when every tab fails", async () => {
    // Setup
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue(
      buildIntegration([buildAgentTabView("broken", 0)]),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("down", { status: 503 })),
    );

    // Act
    const request = fetchAgentTabContents("mediapulse", "agent-1");

    // Assert
    await expect(request).rejects.toThrow("Domain content view failed (503)");
  });

  it("resolves the integration once for all tabs", async () => {
    // Setup
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue(
      buildIntegration([
        buildAgentTabView("first", 0),
        buildAgentTabView("second", 1),
      ]),
    );
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => jsonResponse({ body: "content" }));
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const tabs = await fetchAgentTabContents("mediapulse", "agent-1");

    // Assert
    const firstUrl = String(fetchMock.mock.calls[0]?.[0]);

    expect(tabs).toHaveLength(2);
    expect(getDomainIntegrationByIntegrationIdMock).toHaveBeenCalledTimes(1);
    expect(firstUrl).toBe("http://domain.test/v1/tabs/first?agentId=agent-1");
  });

  it("returns no tabs when the integration is not registered", async () => {
    // Setup
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue(null);

    // Act
    const tabs = await fetchAgentTabContents("missing", "agent-1");

    // Assert
    expect(tabs).toEqual([]);
  });
});

describe("fetchDomainContentView", () => {
  beforeEach(() => {
    getDomainIntegrationByIntegrationIdMock.mockReset();
    getBearerJwtMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a pre-resolved integration without looking it up again", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue("jwt");
    const view = buildAgentTabView("overview", 0);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ body: "hello", title: "Overview" }));
    vi.stubGlobal("fetch", fetchMock);

    // Act
    const content = await fetchDomainContentView({
      integrationId: "mediapulse",
      view,
      integration: buildIntegration([view]),
    });

    // Assert
    expect(content).toEqual({ body: "hello", title: "Overview" });
    expect(getDomainIntegrationByIntegrationIdMock).not.toHaveBeenCalled();
  });

  it("omits the Authorization header when no token is issued", async () => {
    // Setup
    getBearerJwtMock.mockResolvedValue(undefined);
    const view = buildAgentTabView("overview", 0);
    getDomainIntegrationByIntegrationIdMock.mockResolvedValue(
      buildIntegration([view]),
    );
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ body: "hi" }));
    vi.stubGlobal("fetch", fetchMock);

    // Act
    await fetchDomainContentView({ integrationId: "mediapulse", view });

    // Assert
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);

    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("Accept")).toBe("application/json");
  });
});
