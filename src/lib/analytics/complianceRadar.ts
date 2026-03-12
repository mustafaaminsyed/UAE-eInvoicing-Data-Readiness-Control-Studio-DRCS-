export type ComplianceRadarAxisKey =
  | 'mandatory_coverage'
  | 'pint_structure_readiness'
  | 'tax_logic_integrity'
  | 'codelist_conformance'
  | 'master_data_quality'
  | 'exception_control_health';

export interface ComplianceRadarInput {
  mandatoryCoveragePct: number | null;
  drCoveragePct: number | null;
  latestPassRatePct: number | null;
  avgPassRatePct: number | null;
  exceptionIntensityPer100: number | null;
  criticalSharePct: number | null;
  latestCriticalPressurePct: number | null;
  repeatRejectionRatePct: number | null;
  avgHealthScore: number | null;
  slaBreachRatePct: number | null;
  runtimeCodelistChecks: number | null;
  governedCodedDomains: number | null;
}

export interface ComplianceRadarDimension {
  key: ComplianceRadarAxisKey;
  label: string;
  score: number;
  explanation: string;
}

export interface ComplianceRadarResult {
  dimensions: ComplianceRadarDimension[];
  overallScore: number;
  availableSignalCount: number;
  isFallback: boolean;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toPercentOrNull(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clamp(value);
}

function inversePercent(value: number | null): number | null {
  if (value === null) return null;
  return clamp(100 - value);
}

function inverseScaled(value: number | null, multiplier: number): number | null {
  if (value === null) return null;
  return clamp(100 - value * multiplier);
}

function weightedAverageOrFallback(
  items: Array<{ value: number | null; weight: number }>,
  fallback: number
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  items.forEach((item) => {
    if (item.value === null) return;
    weightedSum += item.value * item.weight;
    totalWeight += item.weight;
  });

  if (totalWeight === 0) return clamp(fallback);
  return clamp(weightedSum / totalWeight);
}

export function buildComplianceRadarResult(input: ComplianceRadarInput): ComplianceRadarResult {
  const mandatoryCoverage = toPercentOrNull(input.mandatoryCoveragePct);
  const drCoverage = toPercentOrNull(input.drCoveragePct);
  const latestPassRate = toPercentOrNull(input.latestPassRatePct);
  const avgPassRate = toPercentOrNull(input.avgPassRatePct);
  const exceptionIntensity = toPercentOrNull(input.exceptionIntensityPer100);
  const criticalShare = toPercentOrNull(input.criticalSharePct);
  const latestCriticalPressure = toPercentOrNull(input.latestCriticalPressurePct);
  const repeatRejectionRate = toPercentOrNull(input.repeatRejectionRatePct);
  const avgHealth = toPercentOrNull(input.avgHealthScore);
  const slaBreachRate = toPercentOrNull(input.slaBreachRatePct);
  const runtimeCodelistChecks =
    typeof input.runtimeCodelistChecks === 'number' && Number.isFinite(input.runtimeCodelistChecks)
      ? Math.max(0, input.runtimeCodelistChecks)
      : null;
  const governedCodedDomains =
    typeof input.governedCodedDomains === 'number' && Number.isFinite(input.governedCodedDomains)
      ? Math.max(0, input.governedCodedDomains)
      : null;

  const availableSignalCount = [
    mandatoryCoverage,
    drCoverage,
    latestPassRate,
    avgPassRate,
    exceptionIntensity,
    criticalShare,
    latestCriticalPressure,
    repeatRejectionRate,
    avgHealth,
    slaBreachRate,
  ].filter((value) => value !== null).length;

  const baseQuality = latestPassRate ?? avgPassRate ?? 50;
  const inverseCriticalShare = inversePercent(criticalShare);
  const inverseExceptionLoad = inverseScaled(exceptionIntensity, 2);
  const inverseCriticalPressure = inverseScaled(latestCriticalPressure, 4);
  const inverseRepeatRate = inversePercent(repeatRejectionRate);
  const inverseSlaBreach = inversePercent(slaBreachRate);

  // Mandatory Coverage: emphasize MoF mandatory coverage, with DR coverage as a secondary alignment signal.
  const mandatoryCoverageScore = weightedAverageOrFallback(
    [
      { value: mandatoryCoverage, weight: 0.8 },
      { value: drCoverage, weight: 0.2 },
    ],
    baseQuality
  );

  // PINT Structure Readiness: mostly DR linkage completeness, adjusted by run quality trend.
  const pintStructureScore = weightedAverageOrFallback(
    [
      { value: drCoverage, weight: 0.75 },
      { value: avgPassRate ?? latestPassRate, weight: 0.25 },
    ],
    baseQuality
  );

  // Tax Logic Integrity: run quality with penalties reflected through critical share and exception intensity.
  const taxLogicScore = weightedAverageOrFallback(
    [
      { value: baseQuality, weight: 0.55 },
      { value: inverseCriticalShare, weight: 0.25 },
      { value: inverseExceptionLoad, weight: 0.2 },
    ],
    baseQuality
  );

  const runtimeCodelistCoveragePct =
    runtimeCodelistChecks !== null &&
    governedCodedDomains !== null &&
    governedCodedDomains > 0
      ? clamp((runtimeCodelistChecks / governedCodedDomains) * 100)
      : null;

  // Codelist Conformance: direct runtime codelist enforcement coverage plus observed run quality.
  const codelistConformanceScore = weightedAverageOrFallback(
    [
      { value: runtimeCodelistCoveragePct, weight: 0.55 },
      { value: baseQuality, weight: 0.45 },
    ],
    baseQuality
  );

  // Master Data Quality: client health signal with repeat rejection and critical-pressure adjustments.
  const masterDataQualityScore = weightedAverageOrFallback(
    [
      { value: avgHealth, weight: 0.55 },
      { value: inverseRepeatRate, weight: 0.25 },
      { value: inverseCriticalPressure, weight: 0.2 },
    ],
    baseQuality
  );

  // Exception Control Health: inverse-risk profile from critical mix, load intensity, and SLA pressure.
  const exceptionControlHealthScore = weightedAverageOrFallback(
    [
      { value: inverseCriticalShare, weight: 0.35 },
      { value: inverseExceptionLoad, weight: 0.3 },
      { value: inverseCriticalPressure, weight: 0.25 },
      { value: inverseSlaBreach, weight: 0.1 },
    ],
    inverseCriticalPressure ?? baseQuality
  );

  const dimensions: ComplianceRadarDimension[] = [
    {
      key: 'mandatory_coverage',
      label: 'Mandatory Field Coverage',
      score: mandatoryCoverageScore,
      explanation: 'MoF mandatory-field source coverage with DR-linkage weighting.',
    },
    {
      key: 'pint_structure_readiness',
      label: 'PINT Structure Readiness',
      score: pintStructureScore,
      explanation: 'PINT-AE DR linkage readiness blended with period run quality.',
    },
    {
      key: 'tax_logic_integrity',
      label: 'Tax Logic Integrity',
      score: taxLogicScore,
      explanation: 'Pass-rate strength adjusted by critical and exception load pressure.',
    },
    {
      key: 'codelist_conformance',
      label: 'Code List Conformance',
      score: codelistConformanceScore,
      explanation: 'Runtime codelist enforcement coverage balanced with run quality.',
    },
    {
      key: 'master_data_quality',
      label: 'Master Data Quality',
      score: masterDataQualityScore,
      explanation: 'Client health signal adjusted for repeat rejection and pressure.',
    },
    {
      key: 'exception_control_health',
      label: 'Exception Control Health',
      score: exceptionControlHealthScore,
      explanation: 'Inverse risk from critical mix, exception intensity, and SLA breaches.',
    },
  ];

  const overallScore = clamp(
    dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length
  );

  return {
    dimensions,
    overallScore,
    availableSignalCount,
    isFallback: availableSignalCount === 0,
  };
}
