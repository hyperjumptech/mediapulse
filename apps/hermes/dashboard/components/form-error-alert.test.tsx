import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormErrorAlert } from "./form-error-alert";

describe("FormErrorAlert", () => {
  it("renders the message as a destructive alert", () => {
    // Act
    render(<FormErrorAlert message="Something went wrong" />);

    // Assert
    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveClass("text-destructive");
  });

  it("merges extra classes", () => {
    // Act
    render(<FormErrorAlert message="Oops" className="whitespace-pre-wrap" />);

    // Assert
    expect(screen.getByRole("alert")).toHaveClass("whitespace-pre-wrap");
  });
});
