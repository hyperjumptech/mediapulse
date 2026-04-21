import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SECRET_MASK } from "@/lib/mask-json-secrets";

import { EnqueueDiagnosticsPanel } from "./enqueue-diagnostics-panel";

describe("EnqueueDiagnosticsPanel", () => {
  it("renders nothing when enqueue status is success", () => {
    const { container } = render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="success"
        errors={[{ message: "should not show" }]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders entries for failed with errors", () => {
    render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="failed"
        errors={[
          { message: "Second", timestamp: "2026-01-02T00:00:00.000Z" },
          { message: "First", timestamp: "2026-01-01T00:00:00.000Z" },
        ]}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Enqueue diagnostics" }),
    ).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Enqueue diagnostics" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    const text = region.textContent ?? "";
    expect(text.indexOf("First")).toBeLessThan(text.indexOf("Second"));
  });

  it("renders empty state for failed with null errors", () => {
    render(<EnqueueDiagnosticsPanel enqueueStatus="failed" errors={null} />);
    expect(
      screen.getByText(/No detailed enqueue error was recorded/i),
    ).toBeInTheDocument();
  });

  it("renders empty state for partial with empty array", () => {
    render(<EnqueueDiagnosticsPanel enqueueStatus="partial" errors={[]} />);
    expect(
      screen.getByText(/No detailed enqueue error was recorded/i),
    ).toBeInTheDocument();
  });

  it("renders invalid payload message for non-array errors", () => {
    render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="failed"
        errors={{ not: "array" }}
      />,
    );
    expect(screen.getByText("Invalid error payload")).toBeInTheDocument();
    expect(screen.getByText(/"not"/)).toBeInTheDocument();
  });

  it("masks structured secrets in invalid error JSON before display", () => {
    const { container } = render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="failed"
        errors={{ hint: "bad shape", nested: { apiKey: "must-not-show" } }}
      />,
    );
    expect(container.textContent).not.toContain("must-not-show");
    expect(container.textContent).toContain(SECRET_MASK);
  });

  it("redacts Bearer substrings in diagnostic messages", () => {
    render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="failed"
        errors={[
          {
            message: "Upstream rejected Bearer supersecretvalue",
            timestamp: "2026-01-01T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.queryByText(/supersecretvalue/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Upstream rejected Bearer \[redacted\]/),
    ).toBeInTheDocument();
  });

  it("renders exception stack in a scrollable pre", () => {
    const { container } = render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="partial"
        errors={[
          {
            message: "batch failed",
            timestamp: "2026-04-10T12:00:00.000Z",
            exception: {
              name: "Error",
              stack: "Error: batch failed\n    at enqueue (x.ts:1:1)",
            },
          },
        ]}
      />,
    );
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain("Error: batch failed");
    expect(pre?.textContent).toContain("at enqueue (x.ts:1:1)");
    expect(pre).toHaveAttribute("tabindex", "0");
    expect(screen.getByText(/Exception:/)).toBeInTheDocument();
  });
});
