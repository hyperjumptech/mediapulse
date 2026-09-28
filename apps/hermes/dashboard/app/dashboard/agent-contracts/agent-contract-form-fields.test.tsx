import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AgentContractFormContent,
  isAgentContractFormIncomplete,
  type AgentContractFormState,
} from "./agent-contract-form-fields";

const filledFormState: AgentContractFormState = {
  name: "Weekly brief",
  description: "",
  brief: "Summarize the week.",
  version: "1.0",
};

const useStatefulFormContent = (initialFormState: AgentContractFormState) =>
  useState<AgentContractFormState>(initialFormState);

const StatefulFormContent = ({
  initialFormState,
}: {
  initialFormState: AgentContractFormState;
}) => {
  const [formState, setFormState] = useStatefulFormContent(initialFormState);

  return (
    <form data-testid="contract-form">
      <AgentContractFormContent
        formState={formState}
        setFormState={setFormState}
        disabled={false}
      />
    </form>
  );
};

describe("isAgentContractFormIncomplete", () => {
  it("returns false when name, brief and version are filled", () => {
    // Act
    const incomplete = isAgentContractFormIncomplete(filledFormState);

    // Assert
    expect(incomplete).toBe(false);
  });

  it("returns true when the brief is empty", () => {
    // Act
    const incomplete = isAgentContractFormIncomplete({
      ...filledFormState,
      brief: "",
    });

    // Assert
    expect(incomplete).toBe(true);
  });
});

describe("AgentContractFormContent", () => {
  it("mirrors every field into the hidden inputs posted by the form", () => {
    // Setup
    render(<StatefulFormContent initialFormState={filledFormState} />);

    // Act
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Daily brief" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Short" },
    });
    fireEvent.change(screen.getByLabelText("Version"), {
      target: { value: "2.0" },
    });
    fireEvent.change(screen.getByLabelText("Brief"), {
      target: { value: "Summarize the day." },
    });

    // Assert
    const formData = new FormData(
      screen.getByTestId("contract-form") as HTMLFormElement,
    );

    expect(formData.get("body.name")).toBe("Daily brief");
    expect(formData.get("body.description")).toBe("Short");
    expect(formData.get("body.version")).toBe("2.0");
    expect(formData.get("body.brief")).toBe("Summarize the day.");
  });

  it("renders the brief as a required textarea", () => {
    // Act
    render(<StatefulFormContent initialFormState={filledFormState} />);

    // Assert
    const briefField = screen.getByLabelText("Brief");

    expect(briefField.tagName).toBe("TEXTAREA");
    expect(briefField).toBeRequired();
  });
});
