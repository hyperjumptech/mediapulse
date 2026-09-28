import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JsonBlock } from "./json-block";

const stubBodyHeights = (scrollHeight: number, clientHeight: number) => {
  vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(
    scrollHeight,
  );
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(
    clientHeight,
  );
};

const codeElement = () => {
  const code = document.querySelector("[data-slot='json-block'] pre code");

  if (!(code instanceof HTMLElement)) {
    throw new Error("JsonBlock rendered no code element");
  }

  return code;
};

describe("JsonBlock formatting", () => {
  it("pretty prints an object value", () => {
    render(
      <JsonBlock
        value={{ type: "object", properties: { foo: { type: "string" } } }}
      />,
    );

    expect(codeElement().textContent).toBe(
      '{\n  "type": "object",\n  "properties": {\n    "foo": {\n      "type": "string"\n    }\n  }\n}',
    );
  });

  it("shows an already formatted string unchanged", () => {
    render(<JsonBlock value={'{\n  "method": "POST"\n}'} />);

    expect(codeElement().textContent).toBe('{\n  "method": "POST"\n}');
  });

  it("renders the title in the header row", () => {
    render(<JsonBlock value={{ a: 1 }} title="Config schema" />);

    expect(
      screen.getByRole("heading", { name: "Config schema" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Config schema" }),
    ).toHaveTextContent('"a": 1');
  });

  it.each([null, undefined])(
    "renders a muted dash without actions for %s",
    (value) => {
      render(<JsonBlock value={value} title="Input schema" />);

      expect(screen.getByText("Input schema")).toBeInTheDocument();
      expect(screen.getByText("—")).toHaveClass("text-muted-foreground");
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.queryByRole("region")).not.toBeInTheDocument();
    },
  );
});

describe("JsonBlock copy", () => {
  it("copies the pretty JSON and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<JsonBlock value={{ a: 1 }} title="Config schema" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy config schema" }));

    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toHaveTextContent("Copied");
    expect(writeText).toHaveBeenCalledWith('{\n  "a": 1\n}');
  });

  it("labels the copy button generically without a title", () => {
    render(<JsonBlock value={{ a: 1 }} />);

    expect(screen.getByRole("button", { name: "Copy JSON" })).toHaveTextContent(
      "Copy",
    );
  });
});

describe("JsonBlock wrapping", () => {
  it("wraps long lines by default", () => {
    render(<JsonBlock value={{ a: 1 }} />);

    const wrapToggle = screen.getByRole("button", { name: "Wrap lines" });
    const pre = codeElement().parentElement;

    expect(wrapToggle).toHaveAttribute("aria-pressed", "true");
    expect(pre).toHaveClass("whitespace-pre-wrap", "break-words");
    expect(pre).not.toHaveClass("whitespace-pre");
  });

  it("scrolls horizontally once wrapping is turned off", () => {
    render(<JsonBlock value={{ a: 1 }} />);
    const wrapToggle = screen.getByRole("button", { name: "Wrap lines" });

    fireEvent.click(wrapToggle);

    const pre = codeElement().parentElement;

    expect(wrapToggle).toHaveAttribute("aria-pressed", "false");
    expect(pre).toHaveClass("whitespace-pre");
    expect(pre).not.toHaveClass("whitespace-pre-wrap");
    expect(pre?.parentElement).toHaveClass("overflow-auto");
  });
});

describe("JsonBlock expand", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("caps the body height without an expand toggle when the content fits", () => {
    stubBodyHeights(120, 120);

    render(<JsonBlock value={{ a: 1 }} />);

    expect(screen.getByRole("region", { name: "JSON" })).toHaveClass(
      "max-h-96",
      "overflow-auto",
    );
    expect(
      screen.queryByRole("button", { name: "Show all" }),
    ).not.toBeInTheDocument();
  });

  it("uses a custom height cap", () => {
    render(<JsonBlock value={{ a: 1 }} maxHeight="max-h-48" />);

    const body = screen.getByRole("region", { name: "JSON" });

    expect(body).toHaveClass("max-h-48");
    expect(body).not.toHaveClass("max-h-96");
  });

  it("expands and collapses content taller than the cap", () => {
    stubBodyHeights(900, 384);
    render(<JsonBlock value={{ a: 1 }} title="Details" />);
    const body = screen.getByRole("region", { name: "Details" });
    const showAll = screen.getByRole("button", { name: "Show all" });

    fireEvent.click(showAll);

    const showLess = screen.getByRole("button", { name: "Show less" });

    expect(showAll).toHaveAttribute("aria-controls", body.id);
    expect(showLess).toHaveAttribute("aria-expanded", "true");
    expect(body).not.toHaveClass("max-h-96");

    fireEvent.click(showLess);

    expect(screen.getByRole("button", { name: "Show all" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(body).toHaveClass("max-h-96");
  });
});
