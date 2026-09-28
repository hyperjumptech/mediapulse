import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./schedules-section", () => ({
  SchedulesSection: (props: Record<string, unknown>) => (
    <div data-testid="schedules-section" data-query={JSON.stringify(props)} />
  ),
}));

import SchedulesPage from "./page";

const renderedQuery = () =>
  JSON.parse(
    screen.getByTestId("schedules-section").getAttribute("data-query") ?? "{}",
  );

describe("SchedulesPage", () => {
  it("renders the page header with the new schedule action and the section", async () => {
    // Act
    render(await SchedulesPage({ searchParams: {} }));

    // Assert
    expect(
      screen.getByRole("button", { name: "New schedule" }),
    ).toBeInTheDocument();
    expect(renderedQuery()).toEqual({
      page: 1,
      pageSize: 15,
      sortBy: "name",
      sortDir: "asc",
    });
  });

  it("passes search, sort, and pagination to the section", async () => {
    // Act
    render(
      await SchedulesPage({
        searchParams: Promise.resolve({
          q: " daily ",
          sort: "nextRunAt",
          dir: "desc",
          page: "3",
          size: "25",
        }),
      }),
    );

    // Assert
    expect(renderedQuery()).toEqual({
      page: 3,
      pageSize: 25,
      sortBy: "nextRunAt",
      sortDir: "desc",
      search: "daily",
    });
  });

  it("falls back to defaults for unknown sort fields", async () => {
    // Act
    render(
      await SchedulesPage({ searchParams: { sort: "bogus", dir: "sideways" } }),
    );

    // Assert
    expect(renderedQuery()).toMatchObject({ sortBy: "name", sortDir: "asc" });
  });
});
