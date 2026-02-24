import type { Buyer, InvoiceHeader, InvoiceLine } from "@/types/compliance";
import { classifyInvoice } from "@/modules/scenarioLens/classifyInvoice";
import type {
  ScenarioConfidenceBand,
  ScenarioCoverageSummary,
  ScenarioDistributionDimension,
  ScenarioDistributionRow,
  ScenarioLensFilters,
  ScenarioLensInvoice,
} from "@/modules/scenarioLens/types";

export function buildScenarioLensInvoices(
  headers: InvoiceHeader[],
  lines: InvoiceLine[],
  buyers: Buyer[]
): ScenarioLensInvoice[] {
  const buyerMap = new Map(buyers.map((buyer) => [buyer.buyer_id, buyer]));
  const linesByInvoice = new Map<string, InvoiceLine[]>();

  lines.forEach((line) => {
    if (!linesByInvoice.has(line.invoice_id)) {
      linesByInvoice.set(line.invoice_id, []);
    }
    linesByInvoice.get(line.invoice_id)!.push(line);
  });

  return headers.map((header) => {
    const invoiceLines = linesByInvoice.get(header.invoice_id) ?? [];
    const buyer = buyerMap.get(header.buyer_id);
    const classification = classifyInvoice({
      header: header as unknown as Record<string, unknown>,
      lines: invoiceLines as unknown as Array<Record<string, unknown>>,
      buyer: (buyer ?? null) as unknown as Record<string, unknown> | null,
    });

    return {
      invoiceId: header.invoice_id,
      invoiceNumber: header.invoice_number,
      issueDate: header.issue_date,
      sellerTrn: header.seller_trn,
      buyerId: header.buyer_id,
      sellerCountry: header.seller_country,
      buyerCountry: buyer?.buyer_country,
      currency: header.currency,
      header: header as unknown as Partial<InvoiceHeader> & Record<string, unknown>,
      lines: invoiceLines as unknown as Array<Partial<InvoiceLine> & Record<string, unknown>>,
      classification,
    };
  });
}

export function filterInvoicesByScenario(
  invoices: ScenarioLensInvoice[],
  filters: ScenarioLensFilters
): ScenarioLensInvoice[] {
  return invoices.filter((invoice) => {
    const classification = invoice.classification;

    if (filters.documentType !== "All" && classification.documentType !== filters.documentType) {
      return false;
    }
    if (
      filters.vatTreatment !== "All" &&
      !classification.vatTreatments.includes(filters.vatTreatment)
    ) {
      return false;
    }
    if (
      filters.businessScenario !== "All" &&
      !classification.businessScenarios.includes(filters.businessScenario)
    ) {
      return false;
    }
    if (filters.confidence !== "All") {
      const band = confidenceToBand(classification.confidence);
      if (band !== filters.confidence) return false;
    }

    return true;
  });
}

export function computeScenarioCoverage(
  invoices: ScenarioLensInvoice[]
): ScenarioCoverageSummary {
  const documentTypes = new Set<string>();
  const vatTreatments = new Set<string>();
  const businessScenarios = new Set<string>();

  invoices.forEach((invoice) => {
    documentTypes.add(invoice.classification.documentType);
    invoice.classification.vatTreatments.forEach((vat) => vatTreatments.add(vat));
    invoice.classification.businessScenarios.forEach((scenario) => businessScenarios.add(scenario));
  });

  return {
    documentTypesPresent: documentTypes.size,
    vatTreatmentsPresent: vatTreatments.size,
    businessScenariosPresent: businessScenarios.size,
    invoicesInSelection: invoices.length,
  };
}

export function computeDistribution(
  invoices: ScenarioLensInvoice[],
  dimension: ScenarioDistributionDimension
): ScenarioDistributionRow[] {
  const counts = new Map<string, number>();

  invoices.forEach((invoice) => {
    if (dimension === "documentType") {
      increment(counts, invoice.classification.documentType);
      return;
    }

    if (dimension === "vatTreatments") {
      if (invoice.classification.vatTreatments.length === 0) {
        increment(counts, "Unknown");
      } else {
        invoice.classification.vatTreatments.forEach((value) => increment(counts, value));
      }
      return;
    }

    if (dimension === "businessScenarios") {
      if (invoice.classification.businessScenarios.length === 0) {
        increment(counts, "None");
      } else {
        invoice.classification.businessScenarios.forEach((value) => increment(counts, value));
      }
      return;
    }

    const confidenceBand = confidenceToBand(invoice.classification.confidence) ?? "Unknown";
    increment(counts, confidenceBand);
  });

  const total = Math.max(invoices.length, 1);
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      key,
      count,
      percentage: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count);
}

export function confidenceToBand(confidence?: number): ScenarioConfidenceBand | null {
  if (typeof confidence !== "number") return null;
  if (confidence >= 75) return "High";
  if (confidence >= 45) return "Medium";
  return "Low";
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}
