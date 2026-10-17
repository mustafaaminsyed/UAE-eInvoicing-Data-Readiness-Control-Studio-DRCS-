# DRCS repository map for AI-assisted work

Use this map to find the smallest relevant context. Begin with the named entry point, read its direct imports, and open adjacent tests before searching elsewhere. Paths are relative to the repository root.

## Shared workflow and state

- `src/App.tsx` — route registration and workspace shell boundaries.
- `src/context/ComplianceContext.tsx` — loaded datasets, validation run state, findings, and run outcomes.
- `src/context/WorkspaceContext.tsx` — dataset direction, active mapping profile, and workspace/session state.
- `src/context/UploadLogContext.tsx` — upload audit lifecycle.
- `src/types/` — shared contracts. Open only the type file imported by the target module.
- `src/services/runChecksService.ts` and `src/engine/orchestrator/runChecksOrchestrator.ts` — governed execution entry points.

## Ingestion

- Entry screens: `src/pages/UploadPage.tsx`, `src/pages/SubmissionsPage.tsx`, `src/pages/UploadAuditPage.tsx`.
- File analysis UI: `src/components/upload/FileAnalysis.tsx` and `src/components/upload/upload-ingestion.css`.
- Canonical ingestion: `src/lib/mapping/canonicalIngestionAdapter.ts`, `canonicalizationEngine.ts`, and `src/types/canonicalIngestion.ts`.
- Focused tests: `UploadPage.processing.test.tsx`, `UploadPage.interaction.test.tsx`, `SubmissionsPage.test.tsx`, and the colocated canonical-ingestion tests.

## Mapping

- Entry screen: `src/pages/MappingPage.tsx`.
- Wizard/components: `src/components/mapping/` (`UploadStep`, `MappingStep`, `AnalysisStep`, `SaveStep`, `NativeIngestionPanel`, `MappingCoveragePanel`).
- Domain logic: `src/lib/mapping/datasetFieldCatalog.ts`, `mappingSuggester.ts`, `coverageAnalyzer.ts`, `transformationEngine.ts`, and `itemFieldCompatibility.ts`.
- Contracts/API: `src/types/fieldMapping.ts` and `src/lib/api/mappingApi.ts`.
- Focused tests: `MappingPage.navigation.test.tsx` and colocated mapping component/engine tests.

## PINT-AE validation and check execution

- Entry screens: `src/pages/RunChecksPage.tsx`, `ValidationPage.tsx`, and `CheckRegistryPage.tsx`.
- Built-in controls: `src/lib/checks/uaeUC1CheckPack.ts`, `pintAECheckRunner.ts`, `checksRegistry.ts`, and `overlayRuntimeChecks.ts`.
- Execution architecture: `src/services/runChecksService.ts`, `src/engine/orchestrator/`, and `src/engine/runners/`.
- Regulatory baseline: `specs/uae/regulatory-baseline-1.0.4.json` and `specs/uae/pint-ae/2025-q2.json`.
- Reconciliation material: `docs/reconciliation/pint-ae-1.0.4-functional-delta-register.md` and `docs/review/`.
- Focused tests: colocated runner/registry tests and `RunChecksPage.*.test.tsx`. Run `runChecksService.usageGuard.test.ts` when execution entry points change.

## Regulatory obligations and mandatory fields

- Authoritative artifacts: `specs/uae/**`; MoF source schema is `specs/uae/mof/source-schema-v1.json`.
- Registries: `src/lib/registry/mofSpecRegistry.ts`, `specRegistry.ts`, `drRegistry.ts`, and `controlsRegistry.ts`.
- Semantic linkage: `semanticCrosswalk.ts`, `mofCrosswalkRegistry.ts`, and `validationToDRMap.ts`.
- Coverage/gating: `src/lib/coverage/mofCoverageEngine.ts`, `conformanceEngine.ts`, and `enforcementScope.ts`.
- Governance records: `docs/reconciliation/uae-mof-authoritative-crosswalk.v0.1.*` and related dated gap/cutover documents.
- Focused tests: the colocated registry and coverage tests. Any regulatory change must also test affected traceability and evidence behavior.

## Traceability

- Entry screen: `src/pages/TraceabilityPage.tsx`.
- UI: `src/components/traceability/` (`ScenarioLensPanel`, `DrillDownDialog`).
- Coverage model: `src/lib/coverage/populationCoverage.ts`, `consistencyValidator.ts`, `conformanceEngine.ts`, and `regulatoryExport.ts`.
- Lineage sources: `src/lib/registry/validationToDRMap.ts` and `semanticCrosswalk.ts`.
- Focused tests: `TraceabilityPage.*.test.tsx` plus affected component, coverage, and registry tests.

## Dashboard and operational review

- Executive dashboard: `src/pages/DashboardPage.tsx`.
- Controls dashboard: `src/pages/ControlsDashboardPage.tsx`.
- Investigation surfaces: `ExceptionsPage.tsx`, `InvoiceDetailPage.tsx`, `DataTwinPage.tsx`, `CasesPage.tsx`, and `RejectionsPage.tsx`.
- Shared dashboard UI: `src/components/dashboard/`.
- Focused tests: the corresponding `DashboardPage`, `ControlsDashboardPage`, exception, submission, and Data Twin tests. Do not open every operational page unless shared state is affected.

## Evidence generation

- Entry screens: `src/pages/EvidencePackPage.tsx`, `EvidencePage.tsx`, and `EvidenceWorkspacePage.tsx`.
- Builders/exporters: `src/lib/evidence/evidenceDataBuilder.ts`, `evidenceSummary.ts`, `streamlinedEvidenceReport.ts`, `evidenceExporter.ts`, and `evidenceRunSnapshot.ts`.
- Contracts: `src/types/evidence.ts`.
- Explanation service: `supabase/functions/validation-explain/index.ts`; its schema migration is `supabase/migrations/20260224183000_validation_explanations.sql`.
- Focused tests: colocated evidence tests and `EvidencePackPage.historicalRun.test.tsx`. Preserve historical-run isolation and regulatory lineage.

## Verification ladder

1. Run the colocated test for the changed module.
2. Run directly affected domain tests listed above.
3. Run shared orchestration, traceability, or evidence tests only if their contracts changed.
4. Run `npm run lint`, `npm test`, and `npm run build` for cross-domain, regulatory, release, or explicitly requested verification.

Do not substitute snapshots or weakened assertions for regulatory correctness. If a test conflicts with an authoritative artifact, stop and reconcile the requirement rather than changing the expected result casually.
