import { useMemo, useState } from "react";
import { ChevronDown, Eye, FilterX, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BUSINESS_SCENARIO_OPTIONS,
  CONFIDENCE_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  VAT_TREATMENT_OPTIONS,
} from "@/modules/scenarioLens/types";
import {
  computeDistribution,
  computeScenarioCoverage,
} from "@/modules/scenarioLens/selectors";
import type {
  ScenarioDistributionDimension,
  ScenarioLensFilters,
  ScenarioLensInvoice,
} from "@/modules/scenarioLens/types";

type DistributionGroup = {
  title: string;
  dimension: ScenarioDistributionDimension;
};

interface ScenarioLensPanelProps {
  isDataLoaded: boolean;
  usingMockData: boolean;
  invoices: ScenarioLensInvoice[];
  selectedInvoices: ScenarioLensInvoice[];
  filters: ScenarioLensFilters;
  showConfidenceFilter: boolean;
  onFilterChange: <K extends keyof ScenarioLensFilters>(
    key: K,
    value: ScenarioLensFilters[K]
  ) => void;
  onResetFilters: () => void;
}

const DISTRIBUTION_GROUPS: DistributionGroup[] = [
  { title: "Document Type Distribution", dimension: "documentType" },
  { title: "VAT Treatment Distribution", dimension: "vatTreatments" },
  { title: "Business Scenario Distribution", dimension: "businessScenarios" },
];
const DISTRIBUTION_PREVIEW_LIMIT = 5;

export function ScenarioLensPanel({
  isDataLoaded,
  usingMockData,
  invoices,
  selectedInvoices,
  filters,
  showConfidenceFilter,
  onFilterChange,
  onResetFilters,
}: ScenarioLensPanelProps) {
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [expandedDistributions, setExpandedDistributions] = useState<
    Partial<Record<ScenarioDistributionDimension, boolean>>
  >({});

  const coverage = useMemo(
    () => computeScenarioCoverage(selectedInvoices),
    [selectedInvoices]
  );

  const distributions = useMemo(
    () =>
      DISTRIBUTION_GROUPS.map((group) => ({
        ...group,
        rows: computeDistribution(selectedInvoices, group.dimension),
      })),
    [selectedInvoices]
  );

  const setDistributionExpansion = (
    dimension: ScenarioDistributionDimension,
    isExpanded: boolean
  ) => {
    setExpandedDistributions((current) => ({
      ...current,
      [dimension]: isExpanded,
    }));
  };

  return (
    <>
      <Card className="border shadow-sm">
        <CardContent className="p-4 md:p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">Scenario Lens</h2>
                {usingMockData && (
                  <Badge variant="outline" className="text-[11px]">
                    DEV mock data
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Filter invoice population by document type, VAT treatment, and business scenario.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Invoices in selection: {coverage.invoicesInSelection}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={onResetFilters}
                aria-label="Reset Scenario Lens filters"
              >
                <FilterX className="h-3.5 w-3.5" />
                Reset filters
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={() => setIsInvoiceModalOpen(true)}
                disabled={selectedInvoices.length === 0}
                aria-label="View invoices matching Scenario Lens filters"
              >
                <Eye className="h-3.5 w-3.5" />
                View invoices
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField
              id="scenario-document-type"
              label="Document Type"
              value={filters.documentType}
              options={DOCUMENT_TYPE_OPTIONS}
              onChange={(value) => onFilterChange("documentType", value)}
              disabled={invoices.length === 0}
            />
            <FilterField
              id="scenario-vat-treatment"
              label="VAT Treatment"
              value={filters.vatTreatment}
              options={VAT_TREATMENT_OPTIONS}
              onChange={(value) => onFilterChange("vatTreatment", value)}
              disabled={invoices.length === 0}
            />
            <FilterField
              id="scenario-business-scenario"
              label="Business Scenario"
              value={filters.businessScenario}
              options={BUSINESS_SCENARIO_OPTIONS}
              onChange={(value) => onFilterChange("businessScenario", value)}
              disabled={invoices.length === 0}
            />
            {showConfidenceFilter && (
              <FilterField
                id="scenario-confidence"
                label="Confidence"
                value={filters.confidence}
                options={CONFIDENCE_OPTIONS}
                onChange={(value) => onFilterChange("confidence", value)}
                disabled={invoices.length === 0}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MiniStatCard label="Document Types Present" value={`${coverage.documentTypesPresent} / 5`} />
            <MiniStatCard label="VAT Treatments Present" value={`${coverage.vatTreatmentsPresent} / 10`} />
            <MiniStatCard label="Business Scenarios Present" value={`${coverage.businessScenariosPresent} / 5`} />
            <MiniStatCard label="Invoices in Selection" value={`${coverage.invoicesInSelection}`} />
          </div>

          {!isDataLoaded && invoices.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground bg-muted/20">
              Loading data context. Upload invoice data to activate Scenario Lens.
            </div>
          )}

          {isDataLoaded && invoices.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground bg-muted/20">
              No ingested invoices available yet.
            </div>
          )}

          {invoices.length > 0 && selectedInvoices.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground bg-muted/20">
              No invoices match the current Scenario Lens filters.
            </div>
          )}

          {selectedInvoices.length > 0 && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              {distributions.map((distribution) => (
                <DistributionList
                  key={distribution.dimension}
                  title={distribution.title}
                  dimension={distribution.dimension}
                  rows={distribution.rows}
                  isExpanded={Boolean(expandedDistributions[distribution.dimension])}
                  previewLimit={DISTRIBUTION_PREVIEW_LIMIT}
                  onSetExpanded={setDistributionExpansion}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Invoices in Current Scenario Selection</DialogTitle>
            <DialogDescription>
              Showing first {Math.min(50, selectedInvoices.length)} of {selectedInvoices.length} invoice(s).
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto rounded-md border">
            <table className="w-full min-w-[800px] text-xs">
              <thead className="bg-muted/40 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice #</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Issue Date</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Document Type</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">VAT Treatments</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Business Scenarios</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoices.slice(0, 50).map((invoice) => (
                  <tr key={invoice.invoiceId} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{invoice.invoiceNumber || invoice.invoiceId}</td>
                    <td className="px-3 py-2 text-muted-foreground">{invoice.issueDate || "-"}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[11px]">
                        {invoice.classification.documentType}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {invoice.classification.vatTreatments.length > 0 ? (
                          invoice.classification.vatTreatments.map((value) => (
                            <Badge key={`${invoice.invoiceId}-vat-${value}`} variant="secondary" className="text-[11px]">
                              {value}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">Unknown</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {invoice.classification.businessScenarios.map((value) => (
                          <Badge
                            key={`${invoice.invoiceId}-scenario-${value}`}
                            variant="secondary"
                            className="text-[11px]"
                          >
                            {value}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {selectedInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No invoices available for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as T)} disabled={disabled}>
        <SelectTrigger
          id={id}
          className="h-9 text-xs bg-background"
          aria-label={`Filter by ${label.toLowerCase()}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-1">{value}</p>
    </div>
  );
}

function DistributionList({
  title,
  dimension,
  rows,
  isExpanded,
  previewLimit,
  onSetExpanded,
}: {
  title: string;
  dimension: ScenarioDistributionDimension;
  rows: { key: string; count: number; percentage: number }[];
  isExpanded: boolean;
  previewLimit: number;
  onSetExpanded: (dimension: ScenarioDistributionDimension, isExpanded: boolean) => void;
}) {
  const shouldTruncate = rows.length > previewLimit;
  const previewRows = rows.slice(0, previewLimit);
  const hiddenRows = rows.slice(previewLimit);

  const renderDistributionRow = (row: { key: string; count: number; percentage: number }) => (
    <div key={row.key}>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-foreground">{row.key}</span>
        <span className="text-muted-foreground">
          {row.count} ({row.percentage.toFixed(0)}%)
        </span>
      </div>
      <div className="h-1.5 rounded bg-muted overflow-hidden">
        <div
          className="h-full bg-primary/70 transition-all"
          style={{ width: `${Math.min(100, Math.max(2, row.percentage))}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border p-3">
      <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1">
        <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No categories present.</p>
      ) : (
        <div className="space-y-2">
          {previewRows.map((row) => renderDistributionRow(row))}
          {shouldTruncate && (
            <Collapsible
              open={isExpanded}
              onOpenChange={(nextOpen) => onSetExpanded(dimension, nextOpen)}
            >
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] w-full justify-between"
                  aria-label={
                    isExpanded
                      ? `Hide extra categories for ${title}`
                      : `View all categories for ${title}`
                  }
                >
                  {isExpanded
                    ? "Hide extra categories"
                    : `View all categories (${rows.length - previewLimit} more)`}
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-1">
                <div className="space-y-2 rounded-md border bg-muted/20 p-2 max-h-56 overflow-auto">
                  {hiddenRows.map((row) => renderDistributionRow(row))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}
