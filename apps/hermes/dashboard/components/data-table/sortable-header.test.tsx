import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SortableHeader } from "./sortable-header";

describe("SortableHeader", () => {
  it("marks the active column with its direction", () => {
    // Act
    render(
      <SortableHeader
        label="Name"
        href="/dashboard/schedules?sort=name&dir=desc"
        isActive
        direction="asc"
      />,
    );

    // Assert
    const link = screen.getByRole("link", { name: "Name" });

    expect(link).toHaveAttribute("aria-sort", "ascending");
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/schedules?sort=name&dir=desc",
    );
  });

  it("leaves inactive columns unsorted", () => {
    // Act
    render(
      <SortableHeader
        label="Created"
        href="/x"
        isActive={false}
        direction="asc"
      />,
    );

    // Assert
    expect(screen.getByRole("link", { name: "Created" })).not.toHaveAttribute(
      "aria-sort",
    );
  });
});
