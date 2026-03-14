import { 
  DatasetType,
  FieldMapping, 
  CoverageAnalysis, 
  ValidationResult, 
  normalizeFieldMappings,
} from '@/types/fieldMapping';
import {
  getRegistryFieldByDR,
  type RegistryCoverageResult,
} from '@/lib/registry/specRegistry';
import { getDRRegistry } from '@/lib/registry/drRegistry';
import { getDatasetMandatoryFieldIds, getDatasetTargetFields } from '@/lib/mapping/datasetFieldCatalog';

// Re-export registry coverage for convenience
export type { RegistryCoverageResult };

// Analyze mapping coverage (original logic, still used by existing components)
export function analyzeCoverage(mappings: FieldMapping[], datasetType: DatasetType = 'combined'): CoverageAnalysis {
  const normalizedMappings = normalizeFieldMappings(mappings);
  const mappedFieldIds = new Set(normalizedMappings.map(m => m.targetField.id));

  const datasetFields = getDatasetTargetFields(datasetType);
  const mandatoryFieldIds = getDatasetMandatoryFieldIds(datasetType);
  const mandatoryFields = datasetFields.filter((field) => mandatoryFieldIds.has(field.id));
  const optionalFields = datasetFields.filter((field) => !mandatoryFieldIds.has(field.id));
  
  const mappedMandatory = mandatoryFields.filter(f => mappedFieldIds.has(f.id));
  const unmappedMandatory = mandatoryFields.filter(f => !mappedFieldIds.has(f.id));
  const mappedOptional = optionalFields.filter(f => mappedFieldIds.has(f.id));
  const unmappedOptional = optionalFields.filter(f => !mappedFieldIds.has(f.id));
  
  const mandatoryCoverage = mandatoryFields.length > 0 
    ? (mappedMandatory.length / mandatoryFields.length) * 100 
    : 100;
  
  const totalCoverage = datasetFields.length > 0
    ? ((mappedMandatory.length + mappedOptional.length) / datasetFields.length) * 100
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
export function analyzeRegistryCoverage(
  mappings: FieldMapping[],
  datasetType: DatasetType = 'combined'
): RegistryCoverageResult {
  const normalizedMappings = normalizeFieldMappings(mappings);
  const mappedColumns = new Set(normalizedMappings.map((mapping) => mapping.targetField.id));
  const datasetFiles =
    datasetType === 'combined'
      ? new Set(['headers', 'lines'])
      : datasetType === 'header'
        ? new Set(['headers'])
        : datasetType === 'lines'
          ? new Set(['lines'])
          : new Set(['buyers']);

  const registryEntries = getDRRegistry().filter((entry) => {
    if (!entry.dataset_file) return false;
    return datasetFiles.has(entry.dataset_file);
  });
  const registryFields = registryEntries
    .map((entry) => getRegistryFieldByDR(entry.dr_id))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const mandatory = registryFields.filter((field) => {
    const bridge = registryEntries.find((entry) => entry.dr_id === field.dr_id);
    return bridge?.mandatory_for_default_use_case;
  });
  const conditional = registryFields.filter((field) => {
    const bridge = registryEntries.find((entry) => entry.dr_id === field.dr_id);
    return bridge && !bridge.mandatory_for_default_use_case;
  });
  const mappedMandatory = mandatory.filter((field) =>
    registryEntries
      .find((entry) => entry.dr_id === field.dr_id)
      ?.internal_column_names.some((column) => mappedColumns.has(column))
  );
  const unmappedMandatory = mandatory.filter((field) =>
    !registryEntries
      .find((entry) => entry.dr_id === field.dr_id)
      ?.internal_column_names.some((column) => mappedColumns.has(column))
  );
  const mappedConditional = conditional.filter((field) =>
    registryEntries
      .find((entry) => entry.dr_id === field.dr_id)
      ?.internal_column_names.some((column) => mappedColumns.has(column))
  );
  const unmappedConditional = conditional.filter((field) =>
    !registryEntries
      .find((entry) => entry.dr_id === field.dr_id)
      ?.internal_column_names.some((column) => mappedColumns.has(column))
  );

  const mandatoryCoveragePct =
    mandatory.length > 0 ? (mappedMandatory.length / mandatory.length) * 100 : 100;
  const overallCoveragePct =
    registryFields.length > 0
      ? ((mappedMandatory.length + mappedConditional.length) / registryFields.length) * 100
      : 100;

  return {
    totalRegistryFields: registryFields.length,
    mandatoryRegistryFields: mandatory.length,
    mappedMandatory,
    unmappedMandatory,
    mappedConditional,
    unmappedConditional,
    mandatoryCoveragePct,
    overallCoveragePct,
    isReadyForActivation: unmappedMandatory.length === 0,
  };
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
    overallTotal: analysis.mappedMandatory.length + analysis.unmappedMandatory.length + analysis.mappedOptional.length + analysis.unmappedOptional.length,
    isReadyForValidation: analysis.unmappedMandatory.length === 0,
  };
}
