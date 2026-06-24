# Dashboard Technical Design

## Purpose

This document explains how the DRCS executive dashboard is built, what each visible KPI means, and how developers should implement or extend dashboard metrics safely.

This dashboard is not a generic BI surface. It is a workflow-oriented readiness cockpit for:

- UAE eInvoicing readiness
- PINT-AE conformance
- source data quality
- exception prioritisation
- regulator-facing implementation explainability

Primary implementation sources:

- `src/pages/DashboardPage.tsx`
- `src/hooks/useDashboardMetrics.ts`
- `src/context/ComplianceContext.tsx`
- `src/constants/dashboardLabels.ts`

## Design Principles

- Explainability over visual noise
- Distinguish document-level readiness from rule-level performance
- Prefer deterministic calculations over inferred percentages
- Make scope absence explicit when a KPI is not applicable
- Keep regulator-facing and operational language separate where needed

## Page Architecture

The dashboard is currently assembled directly inside `src/pages/DashboardPage.tsx`.

High-level structure:

1. Context strip
2. Executive compliance KPIs
3. Data quality KPIs
4. UAE-specific compliance coverage
5. Exception breakdown and remediation focus

Runtime data flow:

1. `useCompliance()` supplies:
   - `headers`
   - `buyers`
   - `lines`
   - `checkResults`
   - `exceptions`
   - `getDashboardStats()`
2. `buildDashboardSnapshot()` normalises the active scope into a single `DashboardSnapshot`
3. `computeDashboardMetrics()` provides document-vs-rule metric separation
4. UI cards render from the snapshot

## Source Layers

The dashboard combines three source layers:

### 1. Raw portfolio data

Used for:

- invoice counts
- completeness metrics
- null-rate quality
- duplicate ratio
- currency mismatch logic
- credit-note scenario coverage

Primary sources:

- `headers`
- `buyers`
- `lines`

### 2. Validation run outputs

Used for:

- rule outcomes
- rule pass rate
- submission-ready invoice count
- critical blocker outcomes
- blocker document counts

Primary sources:

- `checkResults`
- `exceptions`

### 3. Context-level summary stats

Used as fallback or compatibility support.

Primary source:

- `getDashboardStats()` from `ComplianceContext`

Important limitation:

- `getDashboardStats().passRate` is legacy-like and document-oriented in `ComplianceContext`
- `computeDashboardMetrics().rulePassRate` is the current rule-outcome-level metric
- developers must not collapse these two layers back into one percentage

## Dashboard Snapshot Contract

The page works from a single in-memory object:

- `DashboardSnapshot`

Key categories inside the snapshot:

- scope context
- readiness scores
- executive KPI values
- data quality KPI values
- UAE coverage values
- exception aggregation
- remediation prioritisation

This snapshot should remain the source of truth for rendering.

## Metric Logic

## 1. Context Strip

These values appear in the top strip above the KPI cards.

### Document flow

Meaning:

- current dataset direction in scope

Value:

- `AR / Outbound` when `activeDatasetType === 'AR'`
- `AP / Inbound` otherwise

Source:

- UI state, not a computed KPI

### Live portfolio snapshot

Meaning:

- indicates checks have been run on the currently loaded portfolio

Logic:

- `Live portfolio snapshot` if `isChecksRun === true`
- `Live data loaded` otherwise

Source field:

- `snapshot.modeLabel`

### Executive attention required

Meaning:

- headline status badge for the current scope

Logic:

1. `Validation running` when `isRunning === true`
2. `Executive attention required` when `snapshot.criticalIssues > 0`
3. `Executive ready` otherwise

Interpretation:

- this is a status badge, not a numeric KPI

### Invoices in scope

Meaning:

- number of invoices included in the active dashboard scope

Formula:

- `stats.totalInvoices || headerRecords.length`

Source:

- `buildDashboardSnapshot()`

Fallback:

- falls back to header count if summary stats are absent

### Rule outcomes

Meaning:

- total number of individual rule evaluations executed

Formula:

- `sum(checkResult.passed + checkResult.failed)`

Source:

- `computeDashboardMetrics().totalRuleOutcomes`

Important:

- one invoice generates many rule outcomes
- this is not a document count

### Critical blockers

Meaning:

- count of critical exception outcomes currently represented in the active scope

Current logic in context strip:

- `snapshot.criticalIssues`

Current formula:

- `stats.exceptionsBySeverity.Critical || scopedCriticalExceptionCount`

Interpretation warning:

- this is currently an outcome-oriented critical count, not a distinct document count
- use `criticalBlockerDocumentCount` and `avgCriticalBlockersPerDocument` when explaining operational burden

## 2. Executive Compliance KPIs

### Go-Live Readiness

Meaning:

- blended executive confidence score for controlled production readiness

Formula:

- `clampScore(weightedAverage(goLiveInputs))`

Dimensions and weights:

- `40%` compliance score
- `15%` null-rate quality
- `10%` duplicate control
- `10%` currency alignment
- `15%` blocker containment
- `10%` credit-note readiness

Component formulas:

- compliance score = `complianceReadiness`
- null-rate quality = `max(0, 100 - nullFieldRate * 4)`
- duplicate control = `max(0, 100 - duplicateInvoiceRatio * 18)`
- currency alignment = `max(0, 100 - ((currencyMismatchCount / totalInvoices) * 180))`
- blocker containment = `max(0, 100 - min(criticalIssues, 10) * 12)`
- credit-note readiness = `creditNote.coverage` when credit notes exist, else `100`

Band logic:

- `>= 90` Ready
- `75 to 89` Watch
- `< 75` Blocked

Important:

- this is a product score, not a regulatory formula
- treat it as a blended decision-support KPI

### Compliance Readiness

Meaning:

- weighted structural and validation readiness baseline

Formula:

- `clampScore(weightedAverage(readinessInputs))`

Dimensions and weights:

- `35%` mandatory data
- `15%` conditional data
- `30%` rule conformance
- `20%` blocker pressure

Component formulas:

- mandatory data = average of header, buyer, and line completeness
- conditional data = conditional completeness percentage
- rule conformance = rule pass rate
- blocker pressure = `max(0, 100 - min(criticalIssues, 10) * 10)`

Important:

- this score excludes null-rate, duplication, and FX alignment penalties that are used in Go-Live Readiness

### Submission-ready invoices

Meaning:

- count of invoices that pass every executed rule check in the active scope

Display:

- `submissionReadyCount / totalInvoices`

Formula:

- `submissionReadyCount = max(totalInvoicesInScope - failedInvoiceIds.size, 0)`
- `submissionReadyRate = submissionReadyCount / totalInvoicesInScope`

Source:

- `computeDashboardMetrics()`

How failed invoices are identified:

1. use invoice-linked failed exceptions from `checkResults[].exceptions` when available
2. fall back to invoice-linked `exceptions`

Important:

- this is the primary document-level go/no-go signal
- do not derive this from rule pass rate

### Rule pass rate

Meaning:

- proportion of executed rule outcomes that passed

Display:

- percentage only

Formula:

- `passedRuleOutcomes / totalRuleOutcomes`

Source:

- `computeDashboardMetrics()`

Important:

- this is a rule-engine performance metric
- one failing rule on one invoice can still leave rule pass rate high while making that invoice not submission-ready

### Critical Blocking Issues

Meaning:

- currently rendered as count of critical issues in active scope

Source:

- `snapshot.criticalIssues`

Current formula:

- `stats.exceptionsBySeverity.Critical || scopedCriticalExceptionCount`

Important distinction:

- this card is not yet using `criticalBlockerDocumentCount`
- when evolving the dashboard, developers should decide whether the card should continue to represent:
  - critical outcomes
  - critical exception cases
  - affected documents

## 3. Data Quality KPIs

### Mandatory Field Completeness

Meaning:

- average completeness across core required fields

Formula:

- average of:
  - header completeness
  - buyer completeness
  - line completeness

Completeness formula per group:

- present mandatory values / total mandatory field slots

Source field groups:

- header: `MANDATORY_HEADER_FIELDS`
- buyer: `MANDATORY_BUYER_FIELDS`
- line: `MANDATORY_LINE_FIELDS`

### Conditional Field Completeness

Meaning:

- completeness across scenario-triggered requirements only

Formula:

- satisfied conditional requirements / triggered conditional requirements

Triggered conditions currently include:

- positive `amount_due` -> `payment_due_date`
- non-AED invoice currency -> `fx_rate` and `tax_currency = AED`
- invoice type `381` -> credit note fields
- buyer name present -> `buyer_trn`

Scope-absent logic:

- if `qualifyingDocumentCount === 0`, the card renders `Not in scope`

Important:

- zero qualifying documents is not a failure

### Null Field Rate

Meaning:

- percentage of evaluated governed fields that are empty

Formula:

- empty governed field slots / total governed field slots evaluated

Important:

- lower is better

### Duplicate Invoice Ratio

Meaning:

- duplicate incidence in the invoice header population

Formula:

- duplicate invoice records / total header records

Current duplicate logic:

- key = `invoice_number` or fallback `invoice_id`

### Invalid Codelist

Meaning:

- count of open exceptions that appear to be codelist-related

Current logic:

- text classification over exception name, message, and check id

Current search terms:

- `codelist`
- `code`
- `iso3166`
- `uncl`
- `unece`
- `currency`
- `payment means`

Important:

- this is heuristic, not registry-driven

### Currency Mismatches

Meaning:

- header-level count of currency / tax-currency / FX inconsistencies

Logic:

- for AED invoices:
  - mismatch if `tax_currency` is populated but not `AED`
- for non-AED invoices:
  - mismatch if `tax_currency !== AED`
  - or `fx_rate` missing / non-numeric / non-positive

## 4. UAE-Specific Compliance Coverage

### IBT Mandatory Fields

Meaning:

- coverage of mandatory invoice business-term fields

Current implementation:

- mirrors `mandatoryCompleteness`

Supporting points shown:

- header completeness
- buyer completeness
- line completeness

Important:

- this is a coverage proxy, not a full formal semantic mapping audit

### PINT-AE Rules

Meaning:

- rule execution and rule pass performance for the selected scope

Current value:

- same percentage as rule pass rate

Supporting points:

- total rule outcomes executed
- current pass rate
- critical issues still blocking

### Credit-Note Scenarios

Meaning:

- readiness of in-scope `381` credit note scenarios

Coverage logic:

- if no credit notes are present:
  - `count = 0`
  - coverage defaults to `100`
- if credit notes are present:
  - each credit note must satisfy:
    - reason code
    - reason text
    - preceding reference unless reason code is `VD`
    - preceding issue date unless reason code is `VD`

Important:

- when no credit notes are present, this behaves as not-applicable rather than failed

## 5. Exception Breakdown and Remediation

### Severity cards

Meaning:

- counts of open exceptions by severity

Formula:

- count scoped exceptions where severity equals:
  - `Critical`
  - `High`
  - `Medium`
  - `Low`

### Top blocking issues

Meaning:

- top recurring exception clusters grouped by check id

Grouping logic:

- group by `exception.checkId`
- count occurrences
- keep highest observed severity for the cluster
- sort by count descending
- show top 5 on dashboard

### Recommended next action panel

Current logic:

- derive top 3 blocking checks from `snapshot.blockingIssues`
- pass them into `TopBlockerActionList`
- use `criticalBlockerOutcomes` as total critical denominator

Navigation:

- clicking a blocker navigates to:
  - `/exceptions?dataset=<scope>&ruleId=<checkId>&sort=count_desc`

### Severity context note

Purpose:

- explain why critical/high issues can dominate the portfolio

Implementation:

- collapsed note using the existing `Collapsible` primitive

## Fallback and Preview Behaviour

When no live signals exist:

- the dashboard renders empty states instead of misleading zeroes

When preview snapshots are used:

- `buildFallbackSnapshot()` injects non-live representative values

Developers must ensure:

- live-truthful states do not silently fall back to preview values
- scope absence uses neutral presentation
- no KPI should show a failure state purely because a scenario is absent

## Important Distinctions Developers Must Preserve

### Document count vs rule-outcome count

Never collapse these:

- invoices in scope
- submission-ready invoices
- critical blocker document count
- total rule outcomes
- critical blocker outcomes

### Rule pass rate vs submission-ready rate

These must remain distinct:

- rule pass rate can be high even when many documents are not submission-ready
- submission-ready rate is stricter because every executed rule must pass on a document

### Scope absence vs poor performance

Examples:

- no credit notes in scope
- no FX invoices in scope
- no conditional-field-triggering documents in scope

These should not render as red failure states.

## Implementation Guidance

When adding a new dashboard metric:

1. add or extend logic in `buildDashboardSnapshot()` or `computeDashboardMetrics()`
2. document:
   - meaning
   - exact formula
   - numerator
   - denominator
   - source fields
   - fallback logic
   - interpretation caveat
3. decide whether it is:
   - live only
   - preview-safe
   - scope-sensitive
4. add unit tests for:
   - normal case
   - empty case
   - divergence case if relevant
   - scope-absent case if relevant

## Testing Guidance

Minimum test coverage expectations for dashboard metrics:

- document-vs-rule divergence
- critical outcome vs critical document count
- conditional completeness scope absence
- URL deep-link filtering from blocker actions
- no-preview fallback contamination when live signals exist

Recommended future tests:

- explicit credit-note coverage permutations
- AED vs foreign-currency mismatch scenarios
- duplicate ratio edge cases
- no invoice-linked exception fallback behavior

## Known Gaps and Risks

### 1. `ComplianceContext.getDashboardStats().passRate` is legacy-style

Current logic:

- `(totalInvoices - invoicesWithExceptions) / totalInvoices`

This is not the same thing as rule pass rate.

### 2. `Invalid Codelist` is heuristic

Current logic is text-based, not registry-backed.

### 3. `Critical Blocking Issues` label may still be interpreted as documents

The codebase now computes:

- `criticalBlockerOutcomes`
- `criticalBlockerDocumentCount`
- `avgCriticalBlockersPerDocument`

But the executive card itself still surfaces a critical issue count without fully disambiguating the semantic type.

### 4. Some readiness scores are product-level composites

They are useful decision-support metrics, but they are not legal formulas defined by PINT-AE or the FTA.

## Suggested Future Refactor

To make the dashboard easier to maintain, consider extracting:

- `src/components/dashboard/ExecutiveKPIs.tsx`
- `src/components/dashboard/DataQualityKPIs.tsx`
- `src/components/dashboard/UAECoverageKPIs.tsx`
- `src/components/dashboard/ExceptionsPanel.tsx`
- `src/lib/dashboard/buildDashboardSnapshot.ts`
- `src/lib/dashboard/dashboardMetricDefinitions.ts`

This would separate:

- metric definition
- snapshot assembly
- UI composition

without changing current behavior.
