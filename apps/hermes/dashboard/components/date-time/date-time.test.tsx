import React from "react";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DateTimeContext } from "@/lib/date-time/date-time-context";

import { DateTime } from "./date-time";

const renderedAt = Date.parse("2026-09-28T12:00:00.000Z");

const staticContext = {
  timeZone: "Asia/Jakarta",
  renderedAt,
  now: new Date(renderedAt),
};

const withContext = (element: React.ReactElement) => (
  <DateTimeContext value={staticContext}>{element}</DateTimeContext>
);

describe("DateTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(renderedAt);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the absolute time in the provided zone", () => {
    render(withContext(<DateTime value="2026-09-28T07:55:00.000Z" />));

    const time = screen.getByText("Sep 28, 14:55");

    expect(time).toHaveAttribute("datetime", "2026-09-28T07:55:00.000Z");
    expect(time).toHaveAttribute("title", "Sep 28, 2026, 14:55 GMT+7");
  });

  it("renders the relative time", () => {
    render(
      withContext(
        <DateTime value="2026-09-28T11:57:00.000Z" variant="relative" />,
      ),
    );

    expect(screen.getByText("3m ago")).toBeInTheDocument();
  });

  it("renders absolute and relative together so touch screens see both", () => {
    render(
      withContext(
        <DateTime
          value="2026-09-28T14:00:00.000Z"
          variant="both"
          style="datetime"
        />,
      ),
    );

    expect(screen.getByText("Sep 28, 2026, 21:00")).toBeInTheDocument();
    expect(screen.getByText("in 2h")).toBeInTheDocument();
  });

  it("formats in an explicit zone when one is passed", () => {
    render(
      withContext(
        <DateTime
          value="2026-09-28T07:55:00.000Z"
          timeZone="America/New_York"
          style="time"
        />,
      ),
    );

    expect(screen.getByText("03:55")).toBeInTheDocument();
  });

  it("renders a dash for invalid values", () => {
    render(withContext(<DateTime value="not-a-date" />));

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("produces the same markup on the server and in the browser", () => {
    const element = withContext(
      <DateTime value="2026-09-28T11:57:00.000Z" variant="both" />,
    );

    const serverContainer = document.createElement("div");
    serverContainer.innerHTML = renderToString(element);
    const { container } = render(element);

    expect(container.innerHTML).toBe(serverContainer.innerHTML);
  });
});
