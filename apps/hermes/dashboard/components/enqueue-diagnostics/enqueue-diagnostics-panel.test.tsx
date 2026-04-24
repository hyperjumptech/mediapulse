import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    expect(
      screen.queryByRole("button", { name: "Copy enqueue diagnostics JSON" }),
    ).not.toBeInTheDocument();
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

  it("does not render Correlation when metadata omits hermesEnqueueCorrelation", () => {
    render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="failed"
        errors={[{ message: "e", timestamp: "2026-01-01T00:00:00.000Z" }]}
        metadata={{ source: "other" }}
      />,
    );
    expect(
      screen.queryByRole("heading", { name: "Correlation" }),
    ).not.toBeInTheDocument();
  });

  it("copies masked diagnostics JSON when Copy JSON is used", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="failed"
        errors={[{ message: "one", timestamp: "2026-01-01T00:00:00.000Z" }]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Copy enqueue diagnostics JSON" }),
    );
    expect(writeText).toHaveBeenCalledTimes(1);
    const firstCall = writeText.mock.calls[0];
    expect(firstCall).toBeDefined();
    const rawJson = firstCall![0];
    if (typeof rawJson !== "string") {
      expect.fail("clipboard writeText expected a string payload");
    }
    const payload = JSON.parse(rawJson) as {
      errors: unknown[];
    };
    expect(Array.isArray(payload.errors)).toBe(true);
    expect(payload.errors).toHaveLength(1);
    expect(payload.errors[0]).toMatchObject({ message: "one" });
  });

  it("renders Correlation and copies request id", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <EnqueueDiagnosticsPanel
        enqueueStatus="failed"
        errors={[{ message: "e", timestamp: "2026-01-01T00:00:00.000Z" }]}
        metadata={{
          hermesEnqueueCorrelation: {
            requestId: "rid-copy-test",
            workerTickId: "555",
          },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Correlation" }),
    ).toBeInTheDocument();
    expect(screen.getByText("rid-copy-test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy Request id" }));
    expect(writeText).toHaveBeenCalledWith("rid-copy-test");
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
