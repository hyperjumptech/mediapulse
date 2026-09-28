import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./pipelines-section", () => ({
  PipelinesSection: (props: Record<string, unknown>) => (
    <div data-testid="pipelines-section" data-query={JSON.stringify(props)} />
  ),
}));

import PipelinesPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("pipelines-section").getAttribute("data-query") ?? "{}",
  );

describe("PipelinesPage", () => {
  it("leaves the new pipeline action to the site header and sorts by last update", async () => {
    render(await PipelinesPage({ searchParams: {} }));

    expect(
      screen.queryByRole("button", { name: "New pipeline" }),
    ).not.toBeInTheDocument();
    expect(renderedQuery()).toEqual({
      page: 1,
      pageSize: 15,
      sortBy: "updated",
      sortDir: "desc",
    });
  });

  it("passes search, sort and pagination to the section", async () => {
    render(
      await PipelinesPage({
        searchParams: Promise.resolve({
          q: " digest ",
          sort: "name",
          dir: "asc",
          page: "2",
          size: "30",
        }),
      }),
    );

    expect(renderedQuery()).toEqual({
      page: 2,
      pageSize: 30,
      sortBy: "name",
      sortDir: "asc",
      search: "digest",
    });
  });

  it("falls back to the default sort for unknown fields", async () => {
    render(
      await PipelinesPage({ searchParams: { sort: "bogus", dir: "sideways" } }),
    );

    expect(renderedQuery()).toMatchObject({
      sortBy: "updated",
      sortDir: "desc",
    });
  });
});
