import React, { useMemo, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, HelpCircle, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  FieldMapping, 
  ERPPreviewData, 
  CoverageAnalysis, 
  ValidationResult,
  ConditionalQuestion,
  CONDITIONAL_QUESTIONS,
  PINT_AE_UC1_FIELDS 
} from '@/types/fieldMapping';
import { analyzeCoverage, validateMappedData, getCoverageStats } from '@/lib/mapping/coverageAnalyzer';

interface AnalysisStepProps {
  previewData: ERPPreviewData;
  mappings: FieldMapping[];
  conditionalAnswers: Record<string, boolean>;
  onConditionalAnswersChange: (answers: Record<string, boolean>) => void;
}

export function AnalysisStep({ 
  previewData, 
  mappings, 
  conditionalAnswers,
  onConditionalAnswersChange 
}: AnalysisStepProps) {
  const [showAllValidation, setShowAllValidation] = useState(false);

  // Calculate coverage analysis
  const coverage = useMemo(() => analyzeCoverage(mappings), [mappings]);
  const stats = useMemo(() => getCoverageStats(coverage), [coverage]);

  // Run validation
  const validationResults = useMemo(() => 
    validateMappedData(mappings, previewData.rows), 
    [mappings, previewData]
  );

  // Filter unmapped mandatory based on conditional answers
  const applicableUnmappedMandatory = useMemo(() => {
    return coverage.unmappedMandatory.filter(field => {
      // Check if field is conditional
      const question = CONDITIONAL_QUESTIONS.find(q => q.fieldIds.includes(field.id));
      if (question) {
        // If question answered "no", field is not applicable
        return conditionalAnswers[question.id] !== false;
      }
      return true;
    });
  }, [coverage.unmappedMandatory, conditionalAnswers]);

  const handleConditionalChange = (questionId: string, value: boolean) => {
    onConditionalAnswersChange({
      ...conditionalAnswers,
      [questionId]: value,
    });
  };

  const passCount = validationResults.filter(r => r.status === 'pass').length;
  const warnCount = validationResults.filter(r => r.status === 'warning').length;
  const errorCount = validationResults.filter(r => r.status === 'error').length;

  const filteredValidation = showAllValidation 
    ? validationResults 
    : validationResults.filter(r => r.status !== 'pass');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <HelpCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Coverage Stats */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Mandatory Field Coverage</CardTitle>
            <CardDescription>Required fields for UC1 Standard Tax Invoice</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">
                    {stats.mandatoryMapped} of {stats.mandatoryTotal} fields mapped
                  </span>
                  <span className="text-sm font-bold">
                    {Math.round(coverage.mandatoryCoverage)}%
                  </span>
                </div>
                <Progress value={coverage.mandatoryCoverage} className="h-3" />
              </div>
              
              {stats.isReadyForValidation ? (
                <div className="flex items-center gap-2 text-green-600 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">All mandatory fields mapped!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-yellow-600 p-3 bg-yellow-50 rounded-lg">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">
                    {applicableUnmappedMandatory.length} mandatory field(s) still need mapping
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation Summary</CardTitle>
            <CardDescription>Sample data quality check</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{passCount}</div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{warnCount}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{errorCount}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conditional Fields Questionnaire */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Business Scenario Questions
          </CardTitle>
          <CardDescription>
            Answer these questions to determine which optional fields are applicable for your use case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {CONDITIONAL_QUESTIONS.map(question => (
              <div key={question.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label htmlFor={question.id} className="text-sm font-medium">
                    {question.question}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Affects: {question.fieldIds.map(id => 
                      PINT_AE_UC1_FIELDS.find(f => f.id === id)?.name
                    ).filter(Boolean).join(', ')}
                  </p>
                </div>
                <Switch
                  id={question.id}
                  checked={conditionalAnswers[question.id] ?? true}
                  onCheckedChange={(v) => handleConditionalChange(question.id, v)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Unmapped Mandatory Fields */}
      {applicableUnmappedMandatory.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="text-yellow-700">Unmapped Mandatory Fields</CardTitle>
            <CardDescription className="text-yellow-600">
              These fields are required for UC1 Standard Tax Invoice but haven't been mapped yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {applicableUnmappedMandatory.map(field => (
                <div key={field.id} className="p-3 bg-white rounded border border-yellow-200">
                  <div className="font-medium">{field.name}</div>
                  <div className="text-xs text-muted-foreground">{field.ibtReference}</div>
                  <div className="text-xs mt-1">{field.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Details */}
      <Collapsible defaultOpen={errorCount > 0 || warnCount > 0}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <CardTitle className="flex items-center gap-2">
                <ChevronDown className="h-4 w-4" />
                Validation Details
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Label className="flex items-center gap-2">
                  <Switch 
                    checked={showAllValidation}
                    onCheckedChange={setShowAllValidation}
                  />
                  Show all results (including passed)
                </Label>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Status</TableHead>
                      <TableHead>PINT-AE Field</TableHead>
                      <TableHead>ERP Column</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredValidation.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{getStatusIcon(result.status)}</TableCell>
                        <TableCell className="font-medium">{result.field}</TableCell>
                        <TableCell className="font-mono text-sm">{result.column}</TableCell>
                        <TableCell>
                          <div>{result.message}</div>
                          {result.sampleIssues && result.sampleIssues.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Examples: {result.sampleIssues.slice(0, 2).map(i => 
                                `Row ${i.row}: "${i.value}"`
                              ).join(', ')}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredValidation.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          {showAllValidation ? 'No validation results' : 'All validations passed!'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
