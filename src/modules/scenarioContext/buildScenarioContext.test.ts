import { describe, expect, it } from "vitest";

import { buildScenarioContext } from "@/modules/scenarioContext/buildScenarioContext";
import { SCENARIO_PARITY_FIXTURES } from "@/modules/scenarioContext/fixtures";

describe("buildScenarioContext", () => {
  it.each(SCENARIO_PARITY_FIXTURES)(
    "derives shadow ScenarioContext for $description",
    ({ input, expectedContext }) => {
      const context = buildScenarioContext(input);

      expect(context.authoritative).toBe(false);
      expect(context.version).toBe("shadow-v1");
      expect(context.documentClass.value).toBe(expectedContext.documentClass);
      expect(context.documentVariant.value).toBe(expectedContext.documentVariant);
      expect(context.transactionFlags.value).toEqual(expectedContext.transactionFlags);
      expect(context.vatTreatments.value).toEqual(expectedContext.vatTreatments);
      expect(context.overlays.value).toEqual(expectedContext.overlays);

      expect(context.documentClass.evidence.length).toBeGreaterThan(0);
      expect(context.documentVariant.evidence.length).toBeGreaterThan(0);
    }
  );

  it("captures provenance from the transaction_type_code decoder", () => {
    const context = buildScenarioContext({
      header: {
        invoice_type: "380",
        transaction_type_code: "10000001",
        seller_country: "AE",
      },
      lines: [],
      buyer: { buyer_country: "SA" },
    });

    expect(context.transactionFlags.value).toEqual(["free_trade_zone", "exports"]);
    expect(context.transactionFlags.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "transaction_type_code",
          field: "transaction_type_code",
        }),
      ])
    );
  });

  it("captures self-billing provenance from profile fields when no boolean is present", () => {
    const context = buildScenarioContext({
      header: {
        invoice_type: "380",
        spec_id: "urn:peppol:pint:selfbilling-1@ae-1#1.0",
        business_process: "urn:peppol:bis:selfbilling",
      },
      lines: [],
      buyer: null,
    });

    expect(context.documentVariant.value).toBe("self_billing");
    expect(context.documentVariant.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "header",
          field: expect.stringMatching(/spec_id|business_process/),
        }),
      ])
    );
  });

  it("derives reverse-charge VAT treatment from AE tax category codes", () => {
    const context = buildScenarioContext({
      header: {
        invoice_type: "380",
      },
      lines: [
        {
          invoice_id: "INV-1",
          line_id: "L-1",
          line_number: 1,
          quantity: 1,
          unit_price: 100,
          line_total_excl_vat: 100,
          vat_rate: 0,
          vat_amount: 0,
          tax_category_code: "AE",
        },
      ],
      buyer: null,
    });

    expect(context.vatTreatments.value).toEqual(expect.arrayContaining(["reverse_charge"]));
  });
});
