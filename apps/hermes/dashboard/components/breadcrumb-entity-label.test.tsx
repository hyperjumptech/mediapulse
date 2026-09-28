import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  BreadcrumbEntityLabel,
  BreadcrumbEntityLabelsProvider,
  useBreadcrumbEntityLabels,
} from "./breadcrumb-entity-label";

const EntityLabelsProbe = () => {
  const entityLabels = useBreadcrumbEntityLabels();
  const serializedEntityLabels = JSON.stringify([...entityLabels.entries()]);

  return <output data-testid="entity-labels">{serializedEntityLabels}</output>;
};

const readEntityLabels = (): Array<[string, string]> =>
  JSON.parse(screen.getByTestId("entity-labels").textContent ?? "[]");

const renderWithProvider = (children: React.ReactNode) =>
  render(
    <BreadcrumbEntityLabelsProvider>
      {children}
      <EntityLabelsProbe />
    </BreadcrumbEntityLabelsProvider>,
  );

describe("BreadcrumbEntityLabel", () => {
  it("renders nothing", () => {
    // Act
    const { container } = render(
      <BreadcrumbEntityLabelsProvider>
        <BreadcrumbEntityLabel segment="pipeline-1" label="Nightly ingest" />
      </BreadcrumbEntityLabelsProvider>,
    );

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("registers its label while mounted", () => {
    // Act
    renderWithProvider(
      <BreadcrumbEntityLabel segment="pipeline-1" label="Nightly ingest" />,
    );

    // Assert
    expect(readEntityLabels()).toEqual([["pipeline-1", "Nightly ingest"]]);
  });

  it("unregisters its label on unmount", () => {
    // Setup
    const { rerender } = renderWithProvider(
      <BreadcrumbEntityLabel segment="pipeline-1" label="Nightly ingest" />,
    );

    // Act
    rerender(
      <BreadcrumbEntityLabelsProvider>
        <EntityLabelsProbe />
      </BreadcrumbEntityLabelsProvider>,
    );

    // Assert
    expect(readEntityLabels()).toEqual([]);
  });

  it("replaces the label when it changes", () => {
    // Setup
    const { rerender } = renderWithProvider(
      <BreadcrumbEntityLabel segment="pipeline-1" label="Nightly ingest" />,
    );

    // Act
    rerender(
      <BreadcrumbEntityLabelsProvider>
        <BreadcrumbEntityLabel segment="pipeline-1" label="Hourly ingest" />
        <EntityLabelsProbe />
      </BreadcrumbEntityLabelsProvider>,
    );

    // Assert
    expect(readEntityLabels()).toEqual([["pipeline-1", "Hourly ingest"]]);
  });

  it("keeps labels for several segments", () => {
    // Act
    renderWithProvider(
      <>
        <BreadcrumbEntityLabel segment="schedule-1" label="Morning run" />
        <BreadcrumbEntityLabel segment="execution-1" label="Run #42" />
      </>,
    );

    // Assert
    expect(readEntityLabels()).toEqual([
      ["schedule-1", "Morning run"],
      ["execution-1", "Run #42"],
    ]);
  });

  it("trims the label and skips blank labels", () => {
    // Act
    renderWithProvider(
      <>
        <BreadcrumbEntityLabel segment="pipeline-1" label="  Nightly  " />
        <BreadcrumbEntityLabel segment="pipeline-2" label="   " />
        <BreadcrumbEntityLabel segment="" label="Orphan" />
      </>,
    );

    // Assert
    expect(readEntityLabels()).toEqual([["pipeline-1", "Nightly"]]);
  });

  it("keeps a newer registration when an older one for the same segment unmounts", () => {
    // Setup
    const CompetingRegistrations = ({ showFirst }: { showFirst: boolean }) => (
      <BreadcrumbEntityLabelsProvider>
        {showFirst ? (
          <BreadcrumbEntityLabel segment="pipeline-1" label="First name" />
        ) : null}
        <BreadcrumbEntityLabel segment="pipeline-1" label="Second name" />
        <EntityLabelsProbe />
      </BreadcrumbEntityLabelsProvider>
    );
    const { rerender } = render(<CompetingRegistrations showFirst />);

    // Act
    rerender(<CompetingRegistrations showFirst={false} />);

    // Assert
    expect(readEntityLabels()).toEqual([["pipeline-1", "Second name"]]);
  });

  it("does nothing outside a provider", () => {
    // Act
    render(
      <>
        <BreadcrumbEntityLabel segment="pipeline-1" label="Nightly ingest" />
        <EntityLabelsProbe />
      </>,
    );

    // Assert
    expect(readEntityLabels()).toEqual([]);
  });
});
