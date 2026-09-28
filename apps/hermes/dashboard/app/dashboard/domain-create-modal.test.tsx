import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

import { DomainCreateModal } from "./domain-create-modal";

const symbolField: DomainTableFormField = {
  kind: "string",
  key: "symbol",
  label: "Symbol",
  required: true,
  nullable: false,
};

describe("DomainCreateModal", () => {
  it("renders nothing when the manifest has no create fields", () => {
    // Act
    const { container } = render(
      <DomainCreateModal fields={[]} createAction={vi.fn()} />,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the create form from the trigger label", () => {
    // Setup
    render(
      <DomainCreateModal
        fields={[symbolField]}
        createAction={vi.fn()}
        triggerLabel="Add Tickers"
      />,
    );

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Add Tickers" }));

    // Assert
    expect(
      screen.getByRole("dialog", { name: "Create new" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
