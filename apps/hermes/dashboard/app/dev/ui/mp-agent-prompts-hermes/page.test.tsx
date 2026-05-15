/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";

const envState: { NODE_ENV: string | undefined } = {
  NODE_ENV: "development",
};

vi.mock("@hermes/env", () => ({
  get env() {
    return envState;
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("./mp-agent-prompts-schemaform-fixture", () => ({
  MpAgentPromptsSchemaformFixture: ({ agentId }: { agentId: string }) => (
    <div data-testid="mp-agent-prompts-fixture">{agentId}</div>
  ),
}));

describe("MpAgentPromptsHermesDevPage", () => {
  beforeEach(() => {
    envState.NODE_ENV = "development";
    vi.mocked(notFound).mockClear();
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("renders the fixture when NODE_ENV is development and agent is allowed", async () => {
    const Page = (await import("./page")).default;

    const ui = await Page({
      searchParams: { agent: "article-analysis" },
    });
    render(ui);

    expect(screen.getByTestId("mp-agent-prompts-fixture")).toHaveTextContent(
      "article-analysis",
    );
    expect(notFound).not.toHaveBeenCalled();
  });

  it("defaults to article-analysis when agent query param is omitted", async () => {
    const Page = (await import("./page")).default;

    const ui = await Page({ searchParams: {} });
    render(ui);

    expect(screen.getByTestId("mp-agent-prompts-fixture")).toHaveTextContent(
      "article-analysis",
    );
  });

  it("calls notFound when NODE_ENV is not development", async () => {
    envState.NODE_ENV = "production";
    const Page = (await import("./page")).default;

    await expect(
      Page({ searchParams: { agent: "article-analysis" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("calls notFound for an unknown agent id", async () => {
    const Page = (await import("./page")).default;

    await expect(
      Page({ searchParams: { agent: "not-a-real-agent" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});
