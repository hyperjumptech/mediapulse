/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DetailBlockHtmlPreviewView } from "./detail-block-html-preview";

describe("DetailBlockHtmlPreviewView", () => {
  it("renders the iframe with srcDoc set to the resolved field", () => {
    render(
      <DetailBlockHtmlPreviewView
        block={{
          type: "htmlPreview",
          label: "Email preview",
          field: "emailPreviewHtml",
        }}
        data={{ emailPreviewHtml: "<p>Hello</p>" }}
      />,
    );

    const iframe = screen.getByTitle("Email preview");
    expect(iframe.tagName.toLowerCase()).toBe("iframe");
    expect(iframe).toHaveAttribute("srcdoc", "<p>Hello</p>");
  });

  it("locks the iframe sandbox to allow-popups only", () => {
    render(
      <DetailBlockHtmlPreviewView
        block={{ type: "htmlPreview", label: "Preview", field: "html" }}
        data={{ html: "<b>x</b>" }}
      />,
    );

    const iframe = screen.getByTitle("Preview");
    expect(iframe).toHaveAttribute("sandbox", "allow-popups");
  });

  it("falls back to the default title when no label is set", () => {
    render(
      <DetailBlockHtmlPreviewView
        block={{ type: "htmlPreview", field: "html" }}
        data={{ html: "<i>y</i>" }}
      />,
    );

    expect(screen.getByTitle("HTML preview")).toBeInTheDocument();
  });

  it("renders an empty srcDoc when the field is missing or non-string", () => {
    render(
      <DetailBlockHtmlPreviewView
        block={{ type: "htmlPreview", label: "Preview", field: "missing" }}
        data={{ other: 123 }}
      />,
    );

    const iframe = screen.getByTitle("Preview");
    expect(iframe).toHaveAttribute("srcdoc", "");
  });
});
