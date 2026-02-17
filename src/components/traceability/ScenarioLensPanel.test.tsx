import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScenarioLensPanel } from "@/components/traceability/ScenarioLensPanel";
import { DEFAULT_SCENARIO_FILTERS, type ScenarioLensFilters } from "@/modules/scenarioLens/types";

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
});
