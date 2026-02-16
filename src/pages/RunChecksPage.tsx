import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { Play, CheckCircle, FileText, Users, List, ArrowRight, RotateCcw, Database, RefreshCw, ChevronDown, AlertCircle, Settings, Map, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCompliance } from '@/context/ComplianceContext';
import { SeverityBadge } from '@/components/SeverityBadge';
import { StatsCard } from '@/components/StatsCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { fetchEnabledPintAEChecks, getChecksDiagnostics, seedUC1CheckPack, ChecksDiagnostics } from '@/lib/api/pintAEApi';
import { fetchActiveTemplates } from '@/lib/api/mappingApi';
import { PintAECheck } from '@/types/pintAE';
import { MappingTemplate, PINT_AE_UC1_FIELDS } from '@/types/fieldMapping';
import { getPintAeSpecMetadata } from '@/lib/pintAE/specCatalog';
import { checkRunReadiness } from '@/lib/coverage/conformanceEngine';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function RunChecksPage() {
  const navigate = useNavigate();
  const { 
    buyers, 
    headers, 
    lines, 
    isDataLoaded, 
    isChecksRun, 
    isRunning, 
    runChecks,
    exceptions 
  } = useCompliance();

  const [pintAEChecks, setPintAEChecks] = useState<PintAECheck[]>([]);
  const [diagnostics, setDiagnostics] = useState<ChecksDiagnostics | null>(null);
  const [isLoadingChecks, setIsLoadingChecks] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [lastSeedResult, setLastSeedResult] = useState<string | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const specMeta = getPintAeSpecMetadata();

  // Mapping template state
  const [mappingTemplates, setMappingTemplates] = useState<MappingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('none');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  const loadChecks = useCallback(async () => {
    setIsLoadingChecks(true);
    console.log('[Run Checks] Fetching enabled checks from Supabase...');
    
    const [checks, diag] = await Promise.all([
      fetchEnabledPintAEChecks(),
      getChecksDiagnostics()
    ]);
    
    setPintAEChecks(checks);
    setDiagnostics(diag);
    
    console.log(`[Run Checks] Loaded ${checks.length} enabled checks from Supabase`);
    console.log('[Run Checks] Diagnostics:', diag);
    
    setIsLoadingChecks(false);
  }, []);

  const loadMappingTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    const templates = await fetchActiveTemplates();
    setMappingTemplates(templates);
    setIsLoadingTemplates(false);
  }, []);

  const handleSeedUC1 = async (force = false) => {
    setIsSeeding(true);
    console.log('[Run Checks] Seeding UC1 pack...', force ? '(force upsert)' : '');
    
    const result = await seedUC1CheckPack(force);
    setLastSeedResult(result.message);
    
    if (result.success) {
      toast.success(result.message);
      await loadChecks();
    } else {
      toast.error(result.message);
    }
    
    setIsSeeding(false);
  };

  useEffect(() => {
    loadChecks();
    loadMappingTemplates();
  }, [loadChecks, loadMappingTemplates]);

  const noMappingProfile = !isLoadingTemplates && mappingTemplates.length === 0;

  if (!isDataLoaded) {
    navigate('/');
    return null;
  }

  // Calculate coverage for selected template
  const selectedTemplate = mappingTemplates.find(t => t.id === selectedTemplateId);
  const mandatoryFields = PINT_AE_UC1_FIELDS.filter(f => f.isMandatory);
  const mappedMandatoryCount = selectedTemplate 
    ? selectedTemplate.mappings.filter(m => 
        m.isConfirmed && mandatoryFields.some(f => f.id === m.targetField.id)
      ).length
    : 0;
  const mandatoryCoverage = selectedTemplate 
    ? Math.round((mappedMandatoryCount / mandatoryFields.length) * 100)
    : 100;
  const unmappedMandatory = selectedTemplate 
    ? mandatoryFields.filter(f => 
        !selectedTemplate.mappings.some(m => m.isConfirmed && m.targetField.id === f.id)
      )
    : [];
  const hasCoverageWarning = selectedTemplate && mandatoryCoverage < 100;
  const readiness = checkRunReadiness(!noMappingProfile, mandatoryCoverage, null);
  const isBlocked = !readiness.canRun;

  const handleRunChecks = async () => {
    if (hasCoverageWarning) {
      const proceed = window.confirm(
        `Warning: ${unmappedMandatory.length} mandatory UC1 field(s) are unmapped. Results may be incomplete. Continue anyway?`
      );
      if (!proceed) return;
    }
    await runChecks();
    navigate('/dashboard');
  };

  const handleRefreshChecks = () => {
    toast.info('Refreshing checks from database...');
    loadChecks();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-5xl py-8 md:py-10">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
            <Play className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-foreground mb-2">
            Run Compliance Checks
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Execute the PINT-AE compliance check library against your uploaded data. 
            This will validate {headers.length} invoices across {isLoadingChecks ? '...' : pintAEChecks.length} checks.
          </p>
        </div>

        {/* Mapping Template Selector */}
        <Card className="mb-8 animate-slide-up surface-glass rounded-2xl border border-white/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Map className="h-5 w-5" />
              Mapping Template
            </CardTitle>
            <CardDescription>
              Select a mapping template to transform your ERP data before running checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-6">
              <div className="flex-1">
                <Select 
                  value={selectedTemplateId} 
                  onValueChange={setSelectedTemplateId}
                  disabled={isLoadingTemplates}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoadingTemplates ? 'Loading...' : 'Select template (optional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No template (use raw data)</SelectItem>
                    {mappingTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id!}>
                        <div className="flex items-center gap-2">
                          <span>{template.templateName}</span>
                          {template.erpType && (
                            <Badge variant="outline" className="text-xs">{template.erpType}</Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">v{template.version}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {mappingTemplates.length === 0 && !isLoadingTemplates && (
                  <p className="text-sm text-muted-foreground mt-2">
                    No mapping templates found.{' '}
                    <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/mapping?tab=create')}>
                      Create one
                    </Button>
                  </p>
                )}
              </div>

              {/* Coverage indicator */}
              {selectedTemplate && (
                <div className="w-64">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">Mandatory Coverage</span>
                    <span className={`text-sm font-bold ${mandatoryCoverage === 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {mandatoryCoverage}%
                    </span>
                  </div>
                  <Progress 
                    value={mandatoryCoverage} 
                    className={`h-2 ${mandatoryCoverage === 100 ? '' : '[&>div]:bg-yellow-500'}`}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {mappedMandatoryCount}/{mandatoryFields.length} mandatory fields mapped
                  </p>
                </div>
              )}
            </div>

            {/* Coverage Warning */}
            {hasCoverageWarning && (
              <Alert variant="destructive" className="mt-4 bg-yellow-500/10 border-yellow-500/30 text-yellow-700">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Coverage Gap</AlertTitle>
                <AlertDescription>
                  {unmappedMandatory.length} mandatory UC1 field(s) are not mapped:{' '}
                  <span className="font-medium">
                    {unmappedMandatory.slice(0, 5).map(f => f.name).join(', ')}
                    {unmappedMandatory.length > 5 && ` +${unmappedMandatory.length - 5} more`}
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Data Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-slide-up">
          <StatsCard
            title="Buyers"
            value={buyers.length}
            icon={<Users className="w-5 h-5" />}
            variant="default"
          />
          <StatsCard
            title="Invoice Headers"
            value={headers.length}
            icon={<FileText className="w-5 h-5" />}
            variant="default"
          />
          <StatsCard
            title="Invoice Lines"
            value={lines.length}
            icon={<List className="w-5 h-5" />}
            variant="default"
          />
        </div>

        {/* Checks Library */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm mb-8 animate-slide-up">
          <div className="p-6 border-b flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground">
                  Checks Library ({isLoadingChecks ? '...' : pintAEChecks.length} checks)
                </h2>
                {diagnostics?.dataSource === 'supabase' && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Database className="w-3 h-3" />
                    Supabase
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                PINT-AE / UAE MoF aligned compliance checks from database
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshChecks}
              disabled={isLoadingChecks}
              className="gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingChecks ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {isLoadingChecks ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading checks from database...
              </div>
            ) : pintAEChecks.length === 0 ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No enabled checks found in database</p>
                <Button onClick={() => handleSeedUC1(true)} disabled={isSeeding}>
                  <Settings className="w-4 h-4 mr-2" />
                  Seed UC1 Check Pack
                </Button>
              </div>
            ) : (
              pintAEChecks.map((check) => (
                <div key={check.check_id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <CheckCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">{check.check_name}</p>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {check.check_id}
                        </code>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{check.description}</p>
                      {check.pint_reference_terms && check.pint_reference_terms.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {check.pint_reference_terms.slice(0, 3).map((term, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {term}
                            </Badge>
                          ))}
                          {check.pint_reference_terms.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{check.pint_reference_terms.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {check.scope}
                    </Badge>
                    <SeverityBadge severity={check.severity} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Mapping Prerequisite Warning */}
        {noMappingProfile && (
          <Alert className="mb-8 bg-amber-500/10 border-amber-500/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700">Mapping required before running checks</AlertTitle>
            <AlertDescription className="text-amber-600">
              No active mapping profile found. You must create and save a mapping template before running compliance checks.
              <div className="mt-3">
                <Button size="sm" onClick={() => navigate('/mapping?tab=create')}>
                  Go to Mapping Studio
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Conformance Gate Banner */}
        {isBlocked && (
          <Alert className="mb-8 bg-destructive/5 border-destructive/20">
            <Shield className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive">Cannot run checks - conformance gate failed</AlertTitle>
            <AlertDescription className="text-destructive/80">
              <ul className="list-disc list-inside mt-2 space-y-1">
                {readiness.reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span>{reason.message}</span>
                    <Link to={reason.link} className="text-primary underline text-sm whitespace-nowrap">
                      {reason.linkLabel}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Link to="/traceability?filter=mandatory" className="text-primary underline text-sm">
                  View full traceability matrix {'->'}
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-4">
          {isChecksRun ? (
            <>
              <Button
                variant="outline"
                onClick={handleRunChecks}
                disabled={isRunning || pintAEChecks.length === 0 || isBlocked}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Re-run Checks
              </Button>
              <Button
                onClick={() => navigate('/dashboard')}
                size="lg"
                className="gap-2"
              >
                View Results
                <ArrowRight className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button
              onClick={handleRunChecks}
              disabled={isRunning || pintAEChecks.length === 0 || isBlocked}
              size="lg"
              className="gap-2 px-8"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Running Checks...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run All Checks ({pintAEChecks.length})
                </>
              )}
            </Button>
          )}
        </div>

        {isChecksRun && (
          <div className="mt-6 text-center animate-fade-in">
            <p className="text-muted-foreground">
              Last run completed: {exceptions.length} exception{exceptions.length !== 1 ? 's' : ''} found
            </p>
          </div>
        )}

        {/* Diagnostics Panel */}
        <div className="mt-8">
          <Collapsible open={isDiagnosticsOpen} onOpenChange={setIsDiagnosticsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between p-4 text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Diagnostics & Admin
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isDiagnosticsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-muted/30 rounded-lg p-6 space-y-4 border">
                <h3 className="font-semibold text-foreground">Check Registry Diagnostics</h3>
                
                {diagnostics ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-background p-4 rounded-lg border">
                      <p className="text-2xl font-bold text-foreground">{diagnostics.totalChecks}</p>
                      <p className="text-sm text-muted-foreground">Total Checks in DB</p>
                    </div>
                    <div className="bg-background p-4 rounded-lg border">
                      <p className="text-2xl font-bold text-primary">{diagnostics.enabledChecks}</p>
                      <p className="text-sm text-muted-foreground">Enabled Checks</p>
                    </div>
                    <div className="bg-background p-4 rounded-lg border">
                      <p className="text-2xl font-bold text-foreground">{diagnostics.uc1CheckCount}</p>
                      <p className="text-sm text-muted-foreground">UC1 Pack Checks</p>
                    </div>
                    <div className="bg-background p-4 rounded-lg border">
                      <div className="flex items-center gap-2">
                        {diagnostics.dataSource === 'supabase' ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            <Database className="w-3 h-3 mr-1" />
                            Supabase
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            No Data
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">Data Source</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Loading diagnostics...</p>
                )}

                <div className="flex items-center gap-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshChecks}
                    disabled={isLoadingChecks}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingChecks ? 'animate-spin' : ''}`} />
                    Refresh Checks
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSeedUC1(false)}
                    disabled={isSeeding}
                  >
                    <Database className="w-4 h-4 mr-2" />
                    Seed UC1 Pack
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSeedUC1(true)}
                    disabled={isSeeding}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Force Upsert UC1
                  </Button>
                </div>

                {lastSeedResult && (
                  <div className="text-sm text-muted-foreground pt-2">
                    Last seed result: <span className="text-foreground">{lastSeedResult}</span>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <p><strong>Fallback to demo checks:</strong> false (using DB-driven checks only)</p>
                  <p><strong>Check execution source:</strong> PINT-AE check runner with Supabase checks</p>
                  <p><strong>Linked PINT-AE schematron rules:</strong> {specMeta.schematronRules}</p>
                  <p><strong>Linked PINT-AE codelists:</strong> {specMeta.codelists}</p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}


