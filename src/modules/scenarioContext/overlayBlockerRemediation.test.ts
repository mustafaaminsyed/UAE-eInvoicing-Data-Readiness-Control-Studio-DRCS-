import { describe, expect, it } from 'vitest';

import {
  getDREntry,
  isDRIngestible,
} from '@/lib/registry/drRegistry';
import {
  getDRRuleTraceability,
  getRegistryFieldByDR,
} from '@/lib/registry/specRegistry';
import { getValidationIdsForDR } from '@/lib/registry/validationToDRMap';
import { buildOverlayCutoverPacket } from '@/modules/scenarioContext/overlayCutoverPlan';
import {
  buildOverlayBlockerRemediationMatrix,
  getMinimumOverlayRemediationSetForCutoverEligibility,
  getOverlayBlockerAssessmentsByNeed,
  getOverlayRegistryCoverageSnapshot,
  OVERLAY_BLOCKED_TARGETS,
} from '@/modules/scenarioContext/overlayBlockerRemediation';

describe('overlay blocker remediation implementation status', () => {
  it('bridges every blocked overlay target through registry, linkage, and runtime-derived traceability', () => {
    const matrix = buildOverlayBlockerRemediationMatrix();

    expect(matrix.targets.map((target) => target.target)).toEqual([...OVERLAY_BLOCKED_TARGETS]);

    matrix.targets.forEach((target) => {
      const registryField = getRegistryFieldByDR(target.target);
      const drEntry = getDREntry(target.target);
      const validationIds = getValidationIdsForDR(target.target, { includeReferenceOnly: true });
      const traceability = getDRRuleTraceability(target.target);

      expect(registryField).toBeDefined();
      expect(drEntry).toBeDefined();
      expect(isDRIngestible(drEntry!)).toBe(true);
      expect(target.layerStatus).toEqual({
        registry: 'complete',
        parser: 'complete',
        canonicalModel: 'complete',
        ingestionPath: 'complete',
        traceabilitySupport: 'complete',
        ruleToDRLinkage: 'complete',
      });
      expect(validationIds.length).toBeGreaterThan(0);
      expect(traceability?.linkedCheckIds.length).toBeGreaterThan(0);
    });
  });

  it('clears the overlay blocked-target lists for enforcement and traceability parity', () => {
    const matrix = buildOverlayBlockerRemediationMatrix();
    const applicabilityTargets = getOverlayBlockerAssessmentsByNeed('authoritative_applicability');
    const enforcementTargets = getOverlayBlockerAssessmentsByNeed('full_runtime_enforcement');
    const traceabilityTargets = getOverlayBlockerAssessmentsByNeed('traceability_explainability_parity');

    expect(applicabilityTargets).toHaveLength(0);
    expect(enforcementTargets).toHaveLength(0);
    expect(traceabilityTargets).toHaveLength(0);
    expect(matrix.remediationByNeed.full_runtime_enforcement.join(' ')).toContain('No blocked target remains');
    expect(matrix.remediationByNeed.traceability_explainability_parity.join(' ')).toContain('No blocked target remains');
  });

  it('updates the minimum remediation recommendation from blocker-removal to cutover readiness', () => {
    const minimumSet = getMinimumOverlayRemediationSetForCutoverEligibility();

    expect(minimumSet.join(' ')).toContain('now bridged through registry, parser, canonical model');
    expect(minimumSet.join(' ')).toContain('full cutover readiness');
  });

  it('shows the seven targets in the authoritative bridge after remediation', () => {
    const snapshot = getOverlayRegistryCoverageSnapshot();

    expect(snapshot.blockedTargetsPresentInRegistry).toEqual([...OVERLAY_BLOCKED_TARGETS]);
  });

  it('removes overlay-family blocked dependencies from the cutover packet', () => {
    const packet = buildOverlayCutoverPacket();

    packet.blockedDependencyReview.forEach((entry) => {
      expect(entry.blockedTargets).toHaveLength(0);
    });
  });
});
