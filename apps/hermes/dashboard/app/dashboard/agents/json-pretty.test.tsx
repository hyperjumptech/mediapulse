import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
