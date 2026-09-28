import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VariableFormFields } from "./variable-form-fields";

describe("VariableFormFields", () => {
  it("renders empty create fields with the secret option unchecked", () => {
    // Act
    render(<VariableFormFields mode="create" pending={false} />);

    // Assert
    expect(screen.getByLabelText("Key")).toHaveValue("");
    expect(screen.getByLabelText("Value")).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Secret")).not.toBeChecked();
    expect(
      screen.getByText("The value will not be shown after save."),
    ).toBeInTheDocument();
  });

  it("prefills a non-secret variable for edit", () => {
    // Act
    const { container } = render(
      <VariableFormFields
        mode="edit"
        id="variable-1"
        initialKey="API_URL"
        initialValue="https://example.com"
        initialNote={null}
        initialIsSecret={false}
        pending={false}
      />,
    );

    // Assert
    expect(container.querySelector('input[name="body.id"]')).toHaveValue(
      "variable-1",
    );
    expect(screen.getByLabelText("Key")).toHaveValue("API_URL");
    expect(screen.getByLabelText("Value")).toHaveValue("https://example.com");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("");
  });

  it("hides a secret value and explains how to change it", () => {
    // Act
    render(
      <VariableFormFields
        mode="edit"
        id="variable-1"
        initialKey="API_KEY"
        initialValue="masked"
        initialNote="Primary key"
        initialIsSecret={true}
        pending={false}
      />,
    );

    // Assert
    const valueInput = screen.getByLabelText("Value");

    expect(valueInput).toHaveAttribute("type", "password");
    expect(valueInput).toHaveValue("");
    expect(valueInput).toHaveAttribute(
      "placeholder",
      "Leave blank to keep current value",
    );
    expect(
      screen.getByText(
        "Secret values cannot be shown. Enter a new value only to change it.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Secret")).toBeChecked();
  });

  it("disables the inputs while pending", () => {
    // Act
    render(<VariableFormFields mode="create" pending={true} />);

    // Assert
    expect(screen.getByLabelText("Key")).toBeDisabled();
    expect(screen.getByLabelText("Secret")).toBeDisabled();
  });
});
