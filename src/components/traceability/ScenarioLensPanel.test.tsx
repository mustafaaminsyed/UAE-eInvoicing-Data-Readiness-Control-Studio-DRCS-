import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScenarioLensPanel } from "@/components/traceability/ScenarioLensPanel";
import {
  DEFAULT_SCENARIO_FILTERS,
  type ScenarioLensFilters,
  type ScenarioLensInvoice,
} from "@/modules/scenarioLens/types";

describe("ScenarioLensPanel", () => {
  it("renders empty-state message when no ingested invoices are available", () => {
    const onFilterChange = <K extends keyof ScenarioLensFilters>(
      _key: K,
      _value: ScenarioLensFilters[K]
    ) => {};

    render(
      <ScenarioLensPanel
        isDataLoaded={true}
        usingMockData={false}
        invoices={[]}
        selectedInvoices={[]}
        filters={DEFAULT_SCENARIO_FILTERS}
        showConfidenceFilter={false}
        onFilterChange={onFilterChange}
        onResetFilters={() => {}}
      />
    );

    expect(screen.getByText("No ingested invoices available yet.")).toBeInTheDocument();
  });

  it("expands and collapses distribution categories when many categories are present", () => {
    const onFilterChange = <K extends keyof ScenarioLensFilters>(
      _key: K,
      _value: ScenarioLensFilters[K]
    ) => {};

    const invoices: ScenarioLensInvoice[] = [
      createInvoice("inv-1", ["Standard-rated"]),
      createInvoice("inv-2", ["Zero-rated"]),
      createInvoice("inv-3", ["Exempt"]),
      createInvoice("inv-4", ["Out-of-scope"]),
      createInvoice("inv-5", ["Reverse charge"]),
      createInvoice("inv-6", ["Margin scheme"]),
    ];

    render(
      <ScenarioLensPanel
        isDataLoaded={true}
        usingMockData={false}
        invoices={invoices}
        selectedInvoices={invoices}
        filters={DEFAULT_SCENARIO_FILTERS}
        showConfidenceFilter={false}
        onFilterChange={onFilterChange}
        onResetFilters={() => {}}
      />
    );

    expect(screen.queryByText("Margin scheme")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /show all categories for vat treatment distribution/i,
      })
    );

    expect(screen.getByText("Margin scheme")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /show fewer categories for vat treatment distribution/i,
      })
    );

    expect(screen.queryByText("Margin scheme")).not.toBeInTheDocument();
  });
});

function createInvoice(
  invoiceId: string,
  vatTreatments: ScenarioLensInvoice["classification"]["vatTreatments"]
): ScenarioLensInvoice {
  return {
    invoiceId,
    invoiceNumber: invoiceId,
    issueDate: "2026-01-01",
    header: {},
    lines: [],
    classification: {
      documentType: "Standard Invoice",
      vatTreatments,
      businessScenarios: ["None"],
      reasons: [],
    },
  };
}
