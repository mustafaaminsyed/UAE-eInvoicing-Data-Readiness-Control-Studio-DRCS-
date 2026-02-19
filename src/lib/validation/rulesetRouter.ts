import { Buyer, DataContext, Exception, InvoiceHeader, Severity } from '@/types/compliance';
import { Direction, OrganizationProfile } from '@/types/direction';

type OrgValidationContext = {
  direction: Direction;
  headers: InvoiceHeader[];
  buyerMap: Map<string, Buyer>;
  uploadSessionId?: string;
  uploadManifestId?: string;
  mappingProfileId?: string;
  rulesetVersion?: string;
};

export const RULESET_VERSION = 'v1.0.0';

export function getRulesetForDirection(direction: Direction): 'AR' | 'AP' {
  return direction;
}

function createOrgProfileException(params: {
  invoice: InvoiceHeader;
  direction: Direction;
  expected: string;
  actual?: string;
  message: string;
  uploadSessionId?: string;
  uploadManifestId?: string;
  mappingProfileId?: string;
  rulesetVersion?: string;
}): Exception {
  const { invoice, direction, expected, actual, message, uploadSessionId, uploadManifestId, mappingProfileId, rulesetVersion } = params;
  const severity: Severity = 'Critical';
  return {
    id: `org-profile-${invoice.invoice_id}-${Math.random().toString(36).slice(2, 8)}`,
    checkId: 'org_profile_our_entity_alignment',
    ruleId: 'ORG-TRN-ALIGNMENT',
    checkName: 'Our-side TRN Alignment',
    severity,
    field: direction === 'AR' ? 'seller_trn' : 'buyer_trn',
    message,
    expectedValue: expected,
    actualValue: actual || '(missing)',
    invoiceId: invoice.invoice_id,
    invoiceNumber: invoice.invoice_number,
    sellerTrn: invoice.seller_trn,
    buyerId: invoice.buyer_id,
    direction,
    uploadSessionId,
    uploadManifestId,
    mappingProfileId,
    rulesetVersion,
  };
}

export function buildOrganizationProfileExceptions(profile: OrganizationProfile, context: OrgValidationContext): Exception[] {
  const { direction, headers, buyerMap, uploadSessionId, uploadManifestId, mappingProfileId, rulesetVersion } = context;
  const allowed = new Set(profile.ourEntityTRNs.map((trn) => trn.trim()).filter(Boolean));
  if (allowed.size === 0) return [];

  const exceptions: Exception[] = [];
  for (const header of headers) {
    const ourSideTrn =
      direction === 'AR'
        ? header.seller_trn
        : header.buyer_trn || buyerMap.get(header.buyer_id)?.buyer_trn;
    if (!ourSideTrn || !allowed.has(ourSideTrn)) {
      exceptions.push(
        createOrgProfileException({
          invoice: header,
          direction,
          expected: `one of [${Array.from(allowed).join(', ')}]`,
          actual: ourSideTrn,
          message:
            direction === 'AR'
              ? `Seller TRN ${ourSideTrn || '(missing)'} is not registered as our entity for AR direction.`
              : `Buyer TRN ${ourSideTrn || '(missing)'} is not registered as our entity for AP direction.`,
          uploadSessionId,
          uploadManifestId,
          mappingProfileId,
          rulesetVersion,
        }),
      );
    }
  }
  return exceptions;
}
