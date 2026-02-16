import { 
  FieldMapping, 
  CoverageAnalysis, 
  ValidationResult, 
  PINT_AE_UC1_FIELDS 
} from '@/types/fieldMapping';
import { 
  getRegistryFields, 
  isMandatoryField, 
  computeRegistryCoverage,
  type RegistryCoverageResult 
} from '@/lib/registry/specRegistry';

// Re-export registry coverage for convenience
export type { RegistryCoverageResult };
export { computeRegistryCoverage };

// Analyze mapping coverage (original logic, still used by existing components)
export function analyzeCoverage(mappings: FieldMapping[]): CoverageAnalysis {
  const mappedFieldIds = new Set(mappings.map(m => m.targetField.id));
  
  const mandatoryFields = PINT_AE_UC1_FIELDS.filter(f => f.isMandatory);
  const optionalFields = PINT_AE_UC1_FIELDS.filter(f => !f.isMandatory);
  
  const mappedMandatory = mandatoryFields.filter(f => mappedFieldIds.has(f.id));
  const unmappedMandatory = mandatoryFields.filter(f => !mappedFieldIds.has(f.id));
  const mappedOptional = optionalFields.filter(f => mappedFieldIds.has(f.id));
  const unmappedOptional = optionalFields.filter(f => !mappedFieldIds.has(f.id));
  
  const mandatoryCoverage = mandatoryFields.length > 0 
    ? (mappedMandatory.length / mandatoryFields.length) * 100 
    : 100;
  
  const totalCoverage = PINT_AE_UC1_FIELDS.length > 0
    ? (mappings.length / PINT_AE_UC1_FIELDS.length) * 100
    : 100;
  
  return {
    mappedMandatory,
    unmappedMandatory,
    mappedOptional,
    unmappedOptional,
    mandatoryCoverage,
    totalCoverage,
  };
}

// Registry-aware coverage: uses the authoritative 50-field spec as source of truth
export function analyzeRegistryCoverage(mappings: FieldMapping[]): RegistryCoverageResult {
  // Build a set of DR IDs that have been mapped (using ibtReference from the target field)
  const mappedDrIds = new Set(mappings.map(m => m.targetField.ibtReference));
  return computeRegistryCoverage(mappedDrIds);
}

// Get registry-based stats summary
export function getRegistryCoverageStats(result: RegistryCoverageResult) {
  return {
    mandatoryMapped: result.mappedMandatory.length,
    mandatoryTotal: result.mandatoryRegistryFields,
    conditionalMapped: result.mappedConditional.length,
    conditionalTotal: result.mappedConditional.length + result.unmappedConditional.length,
    overallMapped: result.mappedMandatory.length + result.mappedConditional.length,
    overallTotal: result.totalRegistryFields,
    isReadyForActivation: result.isReadyForActivation,
    registryVersion: '2025-Q2',
  };
}

// Validate sample data against mappings
export function validateMappedData(
  mappings: FieldMapping[],
  sampleData: Record<string, string>[]
): ValidationResult[] {
  const results: ValidationResult[] = [];
  
  for (const mapping of mappings) {
    const { erpColumn, targetField, sampleValues } = mapping;
    const nonEmptyValues = sampleValues.filter(v => v && v.trim());
    
    // Check for empty values in mandatory fields
    if (targetField.isMandatory && nonEmptyValues.length < sampleValues.length) {
      const emptyCount = sampleValues.length - nonEmptyValues.length;
      results.push({
        field: targetField.name,
        column: erpColumn,
        status: 'warning',
        message: `${emptyCount} empty value(s) found in mandatory field`,
        sampleIssues: sampleValues
          .map((v, i) => ({ row: i + 1, value: v, issue: 'Empty value' }))
          .filter(item => !item.value || !item.value.trim()),
      });
    }
    
    // Validate format patterns
    if (targetField.format && nonEmptyValues.length > 0) {
      const pattern = new RegExp(targetField.format);
      const invalidValues = nonEmptyValues.filter(v => !pattern.test(v.trim()));
      
      if (invalidValues.length > 0) {
        results.push({
          field: targetField.name,
          column: erpColumn,
          status: 'error',
          message: `${invalidValues.length} value(s) don't match required format: ${targetField.format}`,
          sampleIssues: invalidValues.map((v, i) => ({
            row: sampleValues.indexOf(v) + 1,
            value: v,
            issue: `Does not match pattern ${targetField.format}`,
          })),
        });
      }
    }
    
    // Validate allowed values
    if (targetField.allowedValues && nonEmptyValues.length > 0) {
      const invalidValues = nonEmptyValues.filter(v => 
        !targetField.allowedValues!.includes(v.trim())
      );
      
      if (invalidValues.length > 0) {
        results.push({
          field: targetField.name,
          column: erpColumn,
          status: 'error',
          message: `${invalidValues.length} value(s) not in allowed list: ${targetField.allowedValues.join(', ')}`,
          sampleIssues: invalidValues.map((v, i) => ({
            row: sampleValues.indexOf(v) + 1,
            value: v,
            issue: `Not in allowed values`,
          })),
        });
      }
    }
    
    // Validate data types
    if (targetField.dataType === 'number') {
      const invalidNumbers = nonEmptyValues.filter(v => 
        isNaN(parseFloat(v.replace(/[,\s]/g, '')))
      );
      
      if (invalidNumbers.length > 0) {
        results.push({
          field: targetField.name,
          column: erpColumn,
          status: 'error',
          message: `${invalidNumbers.length} value(s) are not valid numbers`,
          sampleIssues: invalidNumbers.map(v => ({
            row: sampleValues.indexOf(v) + 1,
            value: v,
            issue: 'Not a valid number',
          })),
        });
      }
    }
    
    if (targetField.dataType === 'date') {
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{2}-\d{2}-\d{4}$/,
        /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
      ];
      
      const invalidDates = nonEmptyValues.filter(v => 
        !datePatterns.some(p => p.test(v.trim()))
      );
      
      if (invalidDates.length > 0) {
        results.push({
          field: targetField.name,
          column: erpColumn,
          status: 'warning',
          message: `${invalidDates.length} value(s) may need date format transformation`,
          sampleIssues: invalidDates.map(v => ({
            row: sampleValues.indexOf(v) + 1,
            value: v,
            issue: 'Unrecognized date format',
          })),
        });
      }
    }
    
    // If no issues, add a pass result
    if (!results.some(r => r.column === erpColumn)) {
      results.push({
        field: targetField.name,
        column: erpColumn,
        status: 'pass',
        message: 'Validation passed',
      });
    }
  }
  
  return results;
}

// Get coverage statistics (legacy, kept for backward compat)
export function getCoverageStats(analysis: CoverageAnalysis) {
  return {
    mandatoryMapped: analysis.mappedMandatory.length,
    mandatoryTotal: analysis.mappedMandatory.length + analysis.unmappedMandatory.length,
    optionalMapped: analysis.mappedOptional.length,
    optionalTotal: analysis.mappedOptional.length + analysis.unmappedOptional.length,
    overallMapped: analysis.mappedMandatory.length + analysis.mappedOptional.length,
    overallTotal: PINT_AE_UC1_FIELDS.length,
    isReadyForValidation: analysis.unmappedMandatory.length === 0,
  };
}
