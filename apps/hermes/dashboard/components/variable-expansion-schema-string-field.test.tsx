import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createVariableExpansionStringField } from "./variable-expansion-schema-string-field";

const variableExpansionInputMock = vi.fn();

vi.mock("@/components/variable-expansion-input", () => ({
  VariableExpansionInput: (props: {
    value: string;
    onChange: (value: string) => void;
  }) => {
    variableExpansionInputMock(props);
    return (
      <input
        data-testid="variable-expansion-input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    );
  },
}));

describe("createVariableExpansionStringField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    variableExpansionInputMock.mockReset();
  });

  it("passes StringField props and picker options to VariableExpansionInput", () => {
    // Setup
    const onChange = vi.fn();
    const variables = [{ key: "tickerId" }];
    const expansions = [
      { id: "exp-1", name: "Enabled tickers", expansionString: "db:ticker:id" },
    ];
    const StringField = createVariableExpansionStringField(
      variables,
      expansions,
    );

    // Act
    render(
      <StringField
        value="hello"
        onChange={onChange}
        schema={{ type: "string" }}
        name="title"
        path="title"
        id="field-title"
        labelText="Title"
        description="Message title"
        disabled={false}
      />,
    );

    // Assert
    expect(variableExpansionInputMock).toHaveBeenCalledTimes(1);
    expect(variableExpansionInputMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "hello",
        id: "field-title",
        label: "Title",
        description: "Message title",
        disabled: false,
        variables,
        expansions,
      }),
    );
  });

  it("wires onChange through to StringField onChange", () => {
    // Setup
    const onChange = vi.fn();
    const StringField = createVariableExpansionStringField([], []);

    // Act
    render(
      <StringField
        value=""
        onChange={onChange}
        schema={{ type: "string" }}
        name="message"
        path="message"
        id="field-message"
        labelText="Message"
        description={undefined}
        disabled={false}
      />,
    );
    fireEvent.change(screen.getByTestId("variable-expansion-input"), {
      target: { value: "next value" },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith("next value");
  });
});
