import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreatedDateRangeFilter } from "./created-date-range-filter";

describe("CreatedDateRangeFilter", () => {
  it("renders from and to date inputs with active values", () => {
    render(
      <CreatedDateRangeFilter
        basePath="/dashboard/mediapulse/newsletters"
        from="2026-05-01"
        to="2026-05-31"
        preserveParams={{ sort: "createdAt", dir: "desc" }}
      />,
    );

    expect(screen.getByLabelText("From date")).toHaveValue("2026-05-01");
    expect(screen.getByLabelText("To date")).toHaveValue("2026-05-31");
    expect(screen.getByRole("search")).toHaveAttribute(
      "action",
      "/dashboard/mediapulse/newsletters",
    );
    expect(screen.getByRole("link", { name: "Clear dates" })).toHaveAttribute(
      "href",
      "/dashboard/mediapulse/newsletters?sort=createdAt&dir=desc",
    );
  });

  it("hides clear link when no dates are active", () => {
    render(
      <CreatedDateRangeFilter basePath="/dashboard/mediapulse/newsletters" />,
    );

    expect(screen.queryByRole("link", { name: "Clear dates" })).toBeNull();
  });

  it("omits from and to from hidden preserve inputs to avoid duplicates", () => {
    // Setup
    const { container } = render(
      <CreatedDateRangeFilter
        basePath="/dashboard/mediapulse/newsletters"
        from="2026-05-01"
        to="2026-05-31"
        preserveParams={{
          sort: "createdAt",
          dir: "desc",
          from: "2026-01-01",
          to: "2026-01-31",
          q: "acme",
        }}
      />,
    );

    // Act
    const namedControls = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[name]"),
    );
    const names = namedControls.map((control) => control.name);
    const clearHref = screen
      .getByRole("link", { name: "Clear dates" })
      .getAttribute("href");

    // Assert
    expect(names.filter((name) => name === "from")).toHaveLength(1);
    expect(names.filter((name) => name === "to")).toHaveLength(1);
    expect(names.filter((name) => name === "sort")).toHaveLength(1);
    expect(names.filter((name) => name === "q")).toHaveLength(1);
    expect(screen.getByLabelText("From date")).toHaveValue("2026-05-01");
    expect(clearHref).toBe(
      "/dashboard/mediapulse/newsletters?sort=createdAt&dir=desc&q=acme",
    );
  });
});
