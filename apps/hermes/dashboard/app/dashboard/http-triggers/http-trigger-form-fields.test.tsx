import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HttpTriggerFormFields } from "./http-trigger-form-fields";

const pipelines = [
  { id: "pipeline-1", name: "Pipeline A", isActive: true },
  { id: "pipeline-2", name: "Pipeline B", isActive: true },
];

describe("HttpTriggerFormFields", () => {
  it("renders the pipeline and method selects with the default values", () => {
    // Act
    render(
      <HttpTriggerFormFields
        pending={false}
        pipelines={pipelines}
        defaultName=""
        defaultDescription=""
        defaultPipelineId="pipeline-2"
        defaultEnabled={true}
        defaultMethod="PUT"
      />,
    );

    // Assert
    const pipelineSelect = screen.getByLabelText("Pipeline");
    const methodSelect = screen.getByLabelText("Method");

    expect(pipelineSelect).toHaveAttribute("name", "body.pipelineId");
    expect(pipelineSelect).toHaveValue("pipeline-2");
    expect(
      within(pipelineSelect).getByRole("option", { name: "Select a pipeline" }),
    ).toBeDisabled();
    expect(methodSelect).toHaveAttribute("name", "body.method");
    expect(methodSelect).toHaveValue("PUT");
  });

  it("requires a bearer token when creating", () => {
    // Act
    render(
      <HttpTriggerFormFields
        pending={false}
        pipelines={pipelines}
        defaultName=""
        defaultDescription=""
        defaultPipelineId=""
        defaultEnabled={true}
        defaultMethod="POST"
      />,
    );

    // Assert
    expect(screen.getByLabelText("Bearer token")).toBeRequired();
  });

  it("keeps the current token optional when editing", () => {
    // Act
    const { container } = render(
      <HttpTriggerFormFields
        pending={false}
        pipelines={pipelines}
        defaultName="Webhook"
        defaultDescription=""
        defaultPipelineId="pipeline-1"
        defaultEnabled={false}
        defaultMethod="POST"
        defaultTokenHint="abcd"
        httpTriggerId="trigger-1"
        isEdit
      />,
    );

    // Assert
    const tokenInput = screen.getByLabelText(
      "Bearer token (leave blank to keep current)",
    );
    const hiddenIdInput = container.querySelector(
      'input[name="body.httpTriggerId"]',
    );

    expect(tokenInput).not.toBeRequired();
    expect(tokenInput).toHaveAttribute(
      "placeholder",
      "Current token ends with abcd",
    );
    expect(hiddenIdInput).toHaveValue("trigger-1");
    expect(screen.getByLabelText("Enabled")).not.toBeChecked();
  });

  it("disables every control while pending", () => {
    // Act
    render(
      <HttpTriggerFormFields
        pending={true}
        pipelines={pipelines}
        defaultName=""
        defaultDescription=""
        defaultPipelineId=""
        defaultEnabled={true}
        defaultMethod="POST"
      />,
    );

    // Assert
    expect(screen.getByLabelText("Name")).toBeDisabled();
    expect(screen.getByLabelText("Pipeline")).toBeDisabled();
    expect(screen.getByLabelText("Method")).toBeDisabled();
    expect(screen.getByLabelText("Enabled")).toBeDisabled();
  });
});
