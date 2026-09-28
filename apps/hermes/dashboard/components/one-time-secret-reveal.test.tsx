import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OneTimeSecretReveal } from "./one-time-secret-reveal";

describe("OneTimeSecretReveal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the warning, the label and the secret", () => {
    // Act
    render(
      <OneTimeSecretReveal secret="hmcp_secret" secretLabel="API key">
        Paste it into Cursor MCP secrets, not git.
      </OneTimeSecretReveal>,
    );

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Copy this key now. It won't be shown again.",
    );
    expect(
      screen.getByText("Paste it into Cursor MCP secrets, not git."),
    ).toBeInTheDocument();
    expect(screen.getByText("API key")).toBeInTheDocument();
    expect(screen.getByText("hmcp_secret")).toBeInTheDocument();
  });

  it("omits the description when no children are passed", () => {
    // Act
    const { container } = render(
      <OneTimeSecretReveal secret="hmcp_secret" secretLabel="API key" />,
    );

    // Assert
    expect(
      container.querySelector('[data-slot="alert-description"]'),
    ).not.toBeInTheDocument();
  });

  it("copies the secret to the clipboard", async () => {
    // Setup
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<OneTimeSecretReveal secret="hmcp_secret" secretLabel="API key" />);

    // Act
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copy to clipboard" }),
      );
    });

    // Assert
    expect(writeText).toHaveBeenCalledWith("hmcp_secret");
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
