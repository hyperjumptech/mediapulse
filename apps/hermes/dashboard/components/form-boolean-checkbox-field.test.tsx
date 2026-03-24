import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormBooleanCheckboxField } from "./form-boolean-checkbox-field";

describe("FormBooleanCheckboxField", () => {
  it("renders hidden false before checkbox with default checked value true", () => {
    // Act
    const { container } = render(
      <FormBooleanCheckboxField
        name="body.isActive"
        id="body.isActive"
        defaultChecked
        label="Active"
      />,
    );

    // Assert
    const inputs = container.querySelectorAll('input[name="body.isActive"]');
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toHaveAttribute("type", "hidden");
    expect(inputs[0]).toHaveAttribute("value", "false");
    expect(inputs[1]).toHaveAttribute("type", "checkbox");
    expect(inputs[1]).toHaveAttribute("value", "true");
    expect(inputs[1]).toBeChecked();
  });

  it("uses checkedSubmitValue on when set", () => {
    // Act
    const { container } = render(
      <FormBooleanCheckboxField
        name="body.enabled"
        id="sched-enabled"
        defaultChecked={false}
        checkedSubmitValue="on"
        label="Enabled"
      />,
    );

    // Assert
    const checkbox = container.querySelector(
      'input[type="checkbox"][name="body.enabled"]',
    );
    expect(checkbox).toHaveAttribute("value", "on");
    expect(checkbox).not.toBeChecked();
  });

  it("disables only the checkbox", () => {
    // Act
    const { container } = render(
      <FormBooleanCheckboxField
        name="body.isSecret"
        id="body.isSecret"
        defaultChecked={false}
        disabled
        label="Secret"
      />,
    );

    // Assert
    const hidden = container.querySelector('input[type="hidden"]');
    const checkbox = container.querySelector('input[type="checkbox"]');
    expect(hidden).not.toBeDisabled();
    expect(checkbox).toBeDisabled();
  });
});
