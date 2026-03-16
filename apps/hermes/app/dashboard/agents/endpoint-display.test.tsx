import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  EndpointDisplay,
  endpointToRecord,
  formatEndpointValue,
} from "./endpoint-display";

describe("endpointToRecord", () => {
  it("returns null for null", () => {
    expect(endpointToRecord(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(endpointToRecord(undefined)).toBeNull();
  });

  it("returns null for array", () => {
    expect(endpointToRecord([])).toBeNull();
    expect(endpointToRecord([1, 2])).toBeNull();
  });

  it("returns null for primitive", () => {
    expect(endpointToRecord("x")).toBeNull();
    expect(endpointToRecord(1)).toBeNull();
    expect(endpointToRecord(true)).toBeNull();
  });

  it("returns object for plain object", () => {
    const obj = { url: "https://x.com", method: "POST" };
    expect(endpointToRecord(obj)).toEqual(obj);
  });
});

describe("formatEndpointValue", () => {
  it("returns — for null and undefined", () => {
    expect(formatEndpointValue(null)).toBe("—");
    expect(formatEndpointValue(undefined)).toBe("—");
  });

  it("returns string for string number boolean", () => {
    expect(formatEndpointValue("hello")).toBe("hello");
    expect(formatEndpointValue(42)).toBe("42");
    expect(formatEndpointValue(true)).toBe("true");
  });

  it("returns JSON string for object", () => {
    expect(formatEndpointValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("EndpointDisplay", () => {
  it("renders No endpoint when endpoint is null", () => {
    render(<EndpointDisplay endpoint={null} />);
    expect(screen.getByTestId("endpoint-empty")).toHaveTextContent(
      "No endpoint",
    );
  });

  it("renders No endpoint when endpoint is undefined", () => {
    render(<EndpointDisplay endpoint={undefined} />);
    expect(screen.getByTestId("endpoint-empty")).toHaveTextContent(
      "No endpoint",
    );
  });

  it("renders No endpoint when endpoint is empty object", () => {
    render(<EndpointDisplay endpoint={{}} />);
    expect(screen.getByTestId("endpoint-empty")).toHaveTextContent(
      "No endpoint",
    );
  });

  it("renders URL and Method with labels when endpoint has url and method", () => {
    render(
      <EndpointDisplay
        endpoint={{ url: "https://api.example.com/run", method: "POST" }}
      />,
    );
    expect(screen.getByTestId("endpoint-display")).toBeInTheDocument();
    expect(screen.getByText("URL")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.com/run")).toBeInTheDocument();
    expect(screen.getByText("Method")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
  });

  it("renders extra keys with raw key name when not in ENDPOINT_KEY_LABELS", () => {
    render(<EndpointDisplay endpoint={{ customKey: "value" }} />);
    expect(screen.getByText("customKey")).toBeInTheDocument();
    expect(screen.getByText("value")).toBeInTheDocument();
  });
});
