import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuickCreateMenu } from "./quick-create-menu";

describe("QuickCreateMenu", () => {
  it("links each create entry to its form", async () => {
    render(<QuickCreateMenu />);

    await act(async () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "Quick create" }),
        { button: 0, ctrlKey: false },
      );
    });

    expect(screen.getByRole("menuitem", { name: "Pipeline" })).toHaveAttribute(
      "href",
      "/dashboard/pipelines?create=1",
    );
    expect(
      screen.getByRole("menuitem", { name: "Agent config" }),
    ).toHaveAttribute("href", "/dashboard/agent-configs/new");
  });
});
