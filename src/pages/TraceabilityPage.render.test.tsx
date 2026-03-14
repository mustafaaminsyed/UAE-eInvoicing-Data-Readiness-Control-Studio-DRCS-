import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ComplianceProvider, useCompliance } from "@/context/ComplianceContext";
import TraceabilityPage from "@/pages/TraceabilityPage";

function SeedUploadedData() {
  const { setData } = useCompliance();

  useEffect(() => {
    setData(
      {
        buyers: [
          {
            buyer_id: "B001",
            buyer_name: "Acme LLC",
            buyer_trn: "100000000000003",
            source_row_number: 2,
          },
        ],
        headers: [
          {
            invoice_id: "INV001",
            invoice_number: "UAE-2025-0001",
            issue_date: "2025-01-15",
            seller_trn: "100000000000001",
            buyer_id: "B001",
            currency: "AED",
            direction: "AR",
          },
        ],
        lines: [
          {
            line_id: "L001",
            invoice_id: "INV001",
            line_number: 1,
            quantity: 10,
            unit_price: 100,
            line_total_excl_vat: 1000,
            vat_rate: 5,
            vat_amount: 50,
          },
        ],
        direction: "AR",
      },
      "AR"
    );
    // Intentionally run once for test seeding. setData is not memoized in context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

describe("TraceabilityPage", () => {
  it("renders without crashing after route navigation when loaded data includes numeric buyer fields", async () => {
    render(
      <MemoryRouter initialEntries={["/traceability"]}>
        <ComplianceProvider>
          <SeedUploadedData />
          <Routes>
            <Route path="/traceability" element={<TraceabilityPage />} />
          </Routes>
        </ComplianceProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("DR Coverage & Traceability")).toBeInTheDocument();
    expect(await screen.findByText("Coverage Basis")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByText(/Upload data on the/i)
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByTestId("denominator-policy")
    ).toHaveTextContent("MoF Tax 51 | MoF Commercial 49 | PINT 50 | Ingestion 45");
  });
});
