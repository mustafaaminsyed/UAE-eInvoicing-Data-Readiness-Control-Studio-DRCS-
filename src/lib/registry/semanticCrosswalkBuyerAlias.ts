import type {
  SemanticCrosswalkDocumentVariant,
  SemanticCrosswalkRow,
} from '@/lib/registry/semanticCrosswalk';
import {
  getSemanticCrosswalkRowByMoFFieldNumber,
} from '@/lib/registry/semanticCrosswalk';

export interface BuyerSemanticAliasInterpretation {
  crosswalkRowKey: string;
  documentType: SemanticCrosswalkDocumentVariant;
  effectiveSemanticId: string | null;
  effectiveCanonicalField: string;
  currentRuntimeFallbackFields: string[];
  runtimeSemanticSplitSupported: false;
}

function resolveDocumentTypeValue(
  row: SemanticCrosswalkRow,
  documentType: SemanticCrosswalkDocumentVariant
): { semanticId: string | null; canonicalField: string } {
  return {
    semanticId: row.semanticIdByDocumentType?.[documentType] ?? row.semanticId,
    canonicalField: row.dcsCanonicalFieldByDocumentType?.[documentType] ?? row.dcsCanonicalField,
  };
}

export function interpretBuyerSemanticAlias(
  row: SemanticCrosswalkRow,
  documentType: SemanticCrosswalkDocumentVariant
): BuyerSemanticAliasInterpretation {
  const resolved = resolveDocumentTypeValue(row, documentType);

  return {
    crosswalkRowKey: row.key,
    documentType,
    effectiveSemanticId: resolved.semanticId,
    effectiveCanonicalField: resolved.canonicalField,
    currentRuntimeFallbackFields: row.sourceColumnKeys,
    runtimeSemanticSplitSupported: false,
  };
}

export function getBuyerSemanticAliasByMoFFieldNumber(
  mofFieldNumber: 24 | 25,
  documentType: SemanticCrosswalkDocumentVariant
): BuyerSemanticAliasInterpretation {
  const row = getSemanticCrosswalkRowByMoFFieldNumber(mofFieldNumber);
  if (!row) {
    throw new Error(`Missing semantic crosswalk row for MoF field ${mofFieldNumber}`);
  }

  return interpretBuyerSemanticAlias(row, documentType);
}
