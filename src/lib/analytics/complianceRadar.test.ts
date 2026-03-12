import { describe, expect, it } from 'vitest';
import { buildComplianceRadarResult } from '@/lib/analytics/complianceRadar';

describe('buildComplianceRadarResult', () => {
  it('produces six deterministic dimensions with clamped 0-100 scores', () => {
    const result = buildComplianceRadarResult({
      mandatoryCoveragePct: 96,
      drCoveragePct: 88,
      latestPassRatePct: 91,
      avgPassRatePct: 87,
      exceptionIntensityPer100: 9,
      criticalSharePct: 12,
      latestCriticalPressurePct: 4,
      repeatRejectionRatePct: 8,
      avgHealthScore: 84,
      slaBreachRatePct: 6,
      runtimeCodelistChecks: 9,
      governedCodedDomains: 22,
    });

    expect(result.dimensions).toHaveLength(6);
    result.dimensions.forEach((dimension) => {
      expect(dimension.score).toBeGreaterThanOrEqual(0);
      expect(dimension.score).toBeLessThanOrEqual(100);
    });
    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.isFallback).toBe(false);
  });

  it('handles missing data with graceful fallback scoring', () => {
    const result = buildComplianceRadarResult({
      mandatoryCoveragePct: null,
      drCoveragePct: null,
      latestPassRatePct: null,
      avgPassRatePct: null,
      exceptionIntensityPer100: null,
      criticalSharePct: null,
      latestCriticalPressurePct: null,
      repeatRejectionRatePct: null,
      avgHealthScore: null,
      slaBreachRatePct: null,
      runtimeCodelistChecks: null,
      governedCodedDomains: null,
    });

    expect(result.dimensions).toHaveLength(6);
    result.dimensions.forEach((dimension) => {
      expect(dimension.score).toBe(50);
    });
    expect(result.overallScore).toBe(50);
    expect(result.availableSignalCount).toBe(0);
    expect(result.isFallback).toBe(true);
  });

  it('clamps out-of-range input values safely', () => {
    const result = buildComplianceRadarResult({
      mandatoryCoveragePct: 140,
      drCoveragePct: -20,
      latestPassRatePct: 180,
      avgPassRatePct: -90,
      exceptionIntensityPer100: 999,
      criticalSharePct: 300,
      latestCriticalPressurePct: -5,
      repeatRejectionRatePct: 250,
      avgHealthScore: 130,
      slaBreachRatePct: -100,
      runtimeCodelistChecks: 1000,
      governedCodedDomains: 22,
    });

    result.dimensions.forEach((dimension) => {
      expect(dimension.score).toBeGreaterThanOrEqual(0);
      expect(dimension.score).toBeLessThanOrEqual(100);
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });
});
