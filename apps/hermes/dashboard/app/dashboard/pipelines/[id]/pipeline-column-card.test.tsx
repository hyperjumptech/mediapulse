import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PipelineColumnCard } from "./pipeline-column-card";

describe("PipelineColumnCard", () => {
  it("renders a sticky header with title, description and action", () => {
    // Act
    render(
      <PipelineColumnCard
        title="Steps"
        description="Select a step to edit it."
        action={<button type="button">Save</button>}
      >
        <p>Body</p>
      </PipelineColumnCard>,
    );

    // Assert
    const heading = screen.getByRole("heading", { level: 2, name: "Steps" });
    const header = heading.closest('[data-slot="pipeline-column-header"]');

    expect(header).toHaveClass("sticky", "top-0", "bg-card");
    expect(screen.getByText("Select a step to edit it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("omits the description and action when not provided", () => {
    // Act
    const { container } = render(
      <PipelineColumnCard title="Available agents">
        <p>Body</p>
      </PipelineColumnCard>,
    );

    // Assert
    expect(
      container.querySelector('[data-slot="card-description"]'),
    ).toBeNull();
    expect(container.querySelector('[data-slot="card-action"]')).toBeNull();
  });
});
