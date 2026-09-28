import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JsonPretty } from "./json-pretty";

describe("JsonPretty", () => {
  it("renders No schema when value is null", () => {
    render(<JsonPretty value={null} />);
    expect(screen.getByTestId("json-pretty-empty")).toBeInTheDocument();
    expect(screen.getByText("No schema")).toBeInTheDocument();
  });

  it("renders No schema when value is undefined", () => {
    render(<JsonPretty value={undefined} />);
    expect(screen.getByTestId("json-pretty-empty")).toBeInTheDocument();
    expect(screen.getByText("No schema")).toBeInTheDocument();
  });

  it("renders optional title when value is null", () => {
    render(<JsonPretty value={null} title="Input schema" />);
    expect(screen.getByText("Input schema")).toBeInTheDocument();
    expect(screen.getByText("No schema")).toBeInTheDocument();
  });

  it("renders pretty-printed JSON for object", () => {
    const value = { type: "object", properties: { foo: { type: "string" } } };
    render(<JsonPretty value={value} />);
    expect(screen.getByTestId("json-pretty")).toBeInTheDocument();
    expect(screen.getByText(/"type": "object"/)).toBeInTheDocument();
    expect(screen.getByText(/"properties":/)).toBeInTheDocument();
  });

  it("renders pretty-printed JSON for array", () => {
    render(<JsonPretty value={[1, 2, "three"]} />);
    expect(screen.getByTestId("json-pretty")).toBeInTheDocument();
    expect(screen.getByText(/\[/)).toBeInTheDocument();
    expect(screen.getByText(/1,/)).toBeInTheDocument();
    expect(screen.getByText(/"three"/)).toBeInTheDocument();
  });

  it("renders pretty-printed JSON for string", () => {
    render(<JsonPretty value="hello" />);
    expect(screen.getByTestId("json-pretty")).toBeInTheDocument();
    expect(screen.getByText(/"hello"/)).toBeInTheDocument();
  });

  it("renders optional title when value is present", () => {
    render(<JsonPretty value={{ a: 1 }} title="Config schema" />);
    expect(screen.getByText("Config schema")).toBeInTheDocument();
    expect(screen.getByText(/"a": 1/)).toBeInTheDocument();
  });
});

describe("JsonPretty copy", () => {
  it("copies the pretty-printed JSON and confirms", async () => {
    // Setup
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<JsonPretty value={{ a: 1 }} title="Config schema" />);

    // Act
    fireEvent.click(screen.getByRole("button", { name: "Copy config schema" }));

    // Assert
    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toHaveTextContent("Copied");
    expect(writeText).toHaveBeenCalledWith('{\n  "a": 1\n}');
  });

  it("labels the copy button generically without a title", () => {
    // Act
    render(<JsonPretty value={{ a: 1 }} />);

    // Assert
    expect(screen.getByRole("button", { name: "Copy JSON" })).toHaveTextContent(
      "Copy",
    );
  });

  it("does not offer copy when there is no schema", () => {
    // Act
    render(<JsonPretty value={null} title="Input schema" />);

    // Assert
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
