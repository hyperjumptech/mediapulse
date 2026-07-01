/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import { DomainTableFormFields } from "./domain-table-form-fields";
import type { DomainTableFormField } from "@/lib/domain-table-form-schema";

// Radix Checkbox's hidden form input measures itself via ResizeObserver, which
// jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  globalThis.ResizeObserver ??=
    ResizeObserverStub as unknown as typeof ResizeObserver;
});

const booleanField: DomainTableFormField = {
  kind: "boolean",
  key: "enabled",
  label: "Enabled",
  required: true,
};

describe("DomainTableFormFields boolean field", () => {
  it("renders an unchecked checkbox when the row value is false", () => {
    render(
      <form>
        <DomainTableFormFields
          fields={[booleanField]}
          defaultRow={{ enabled: false }}
        />
      </form>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Enabled" });

    expect(checkbox).toHaveAttribute("aria-checked", "false");
  });

  it("renders a checked checkbox when the row value is true", () => {
    render(
      <form>
        <DomainTableFormFields
          fields={[booleanField]}
          defaultRow={{ enabled: true }}
        />
      </form>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Enabled" });

    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("posts the field as an un-required checkbox with value 'true'", () => {
    const { container } = render(
      <form>
        <DomainTableFormFields
          fields={[booleanField]}
          defaultRow={{ enabled: false }}
        />
      </form>,
    );
    const input = container.querySelector<HTMLInputElement>(
      "input[type='checkbox'][name='enabled']",
    );

    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("value", "true");
    expect(input).not.toBeRequired();
  });
});
