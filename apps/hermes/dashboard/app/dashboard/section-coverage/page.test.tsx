import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getRollupMock = vi.fn();

vi.mock("@/lib/section-coverage-rollup", () => ({
  getSectionCoverageRollupForTicker: (...args: unknown[]) =>
    getRollupMock(...args),
}));

vi.mock("@/components/page-header", () => ({
  PageHeader: ({
    title,
    description,
  }: {
    title: string;
    description?: string;
  }) => (
    <header data-testid="page-header">
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </header>
  ),
}));

vi.mock("./section-coverage-content", () => ({
  SectionCoverageContent: ({
    tickerId,
    rows,
  }: {
    tickerId: string;
    rows: unknown[];
  }) => (
    <div
      data-testid="section-coverage-content"
      data-ticker-id={tickerId}
      data-row-count={rows.length}
    />
  ),
}));

vi.mock("@/components/with-auth-protection", () => ({
  withAuthProtection: <T,>(Component: T) => Component,
}));

describe("SectionCoveragePage", () => {
  it("loads rollup rows when ticker query param is present", async () => {
    getRollupMock.mockResolvedValue([
      {
        contractVersion: null,
        coverageRunCount: 1,
        fillRunCount: 0,
        bySection: {},
      },
    ]);

    const { default: SectionCoveragePage } = await import("./page");

    const element = await SectionCoveragePage({
      searchParams: { ticker: "ticker-abc", window: "14" },
    });

    render(element);

    expect(getRollupMock).toHaveBeenCalledWith("ticker-abc", 14);
    expect(screen.getByTestId("section-coverage-content")).toHaveAttribute(
      "data-row-count",
      "1",
    );
  });

  it("skips rollup fetch when ticker query param is missing", async () => {
    getRollupMock.mockClear();

    const { default: SectionCoveragePage } = await import("./page");

    const element = await SectionCoveragePage({
      searchParams: {},
    });

    render(element);

    expect(getRollupMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("section-coverage-content")).toHaveAttribute(
      "data-row-count",
      "0",
    );
  });
});
