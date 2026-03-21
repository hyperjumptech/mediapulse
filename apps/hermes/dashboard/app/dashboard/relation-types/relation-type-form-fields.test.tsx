import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RelationTypeFormFields } from "./relation-type-form-fields";

vi.mock("@workspace/ui/components/button", () => ({
  Button: ({
    children,
    type,
    disabled,
  }: React.PropsWithChildren<{ type?: string; disabled?: boolean }>) => (
    <button type={type as "submit" | "button"} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@workspace/ui/components/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@workspace/ui/components/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: React.PropsWithChildren<{ htmlFor?: string }>) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}));

describe("RelationTypeFormFields", () => {
  it("create mode omits hidden id and shows error when provided", () => {
    render(
      <form>
        <RelationTypeFormFields
          mode="create"
          pending={false}
          errorMessage="Name taken"
          submitLabel="Create"
        />
      </form>,
    );

    expect(
      document.querySelector('input[name="body.relationTypeId"]'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Name taken");
  });

  it("edit mode includes hidden id and empty description when null", () => {
    render(
      <form>
        <RelationTypeFormFields
          mode="edit"
          relationTypeId="rt-1"
          initialName="X"
          initialDescription={null}
          pending={false}
          errorMessage={null}
          submitLabel="Save"
        />
      </form>,
    );

    const hidden = document.querySelector(
      'input[name="body.relationTypeId"]',
    ) as HTMLInputElement | null;
    expect(hidden?.value).toBe("rt-1");
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });
});
