import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";
import { ComplianceProvider } from "@/context/ComplianceContext";
import { Navigation } from "@/components/Navigation";
import LandingPage from "./pages/LandingPage";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";

const UploadPage = lazy(() => import("./pages/UploadPage"));
const RunChecksPage = lazy(() => import("./pages/RunChecksPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DataTwinPage = lazy(() => import("./pages/DataTwinPage"));
const ExceptionsWorkspacePage = lazy(() => import("./pages/ExceptionsWorkspacePage"));
const InvoiceDetailPage = lazy(() => import("./pages/InvoiceDetailPage"));
const CheckBuilderPage = lazy(() => import("./pages/CheckBuilderPage"));
const CheckRegistryPage = lazy(() => import("./pages/CheckRegistryPage"));
const UploadAuditPage = lazy(() => import("./pages/UploadAuditPage"));
const APInvoiceExplorerPage = lazy(() => import("./pages/APInvoiceExplorerPage"));
const ControlsDashboardPage = lazy(() => import("./pages/ControlsDashboardPage"));
const CasesPage = lazy(() => import("./pages/CasesPage"));
const RejectionsPage = lazy(() => import("./pages/RejectionsPage"));
const MappingPage = lazy(() => import("./pages/MappingPage"));
const EvidencePage = lazy(() => import("./pages/EvidencePage"));
const EvidencePackPage = lazy(() => import("./pages/EvidencePackPage"));
const TraceabilityPage = lazy(() => import("./pages/TraceabilityPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
      <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/80 px-4 py-2 text-sm text-muted-foreground shadow-sm backdrop-blur">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading workspace...</span>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="drcs.theme"
    >
      <TooltipProvider>
        <ComplianceProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="app-shell min-h-screen relative overflow-x-clip">
              <div className="pointer-events-none absolute inset-0 app-gradient-wash" />
              <div className="pointer-events-none absolute inset-0 app-grid-veil" />
              <Navigation />
              <main className="relative z-10">
                <Suspense fallback={<RouteLoadingFallback />}>
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route element={<WorkspaceShell />}>
                      <Route path="/upload" element={<UploadPage />} />
                      <Route path="/run" element={<RunChecksPage />} />
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/data-twin" element={<DataTwinPage />} />
                      <Route path="/exceptions" element={<ExceptionsWorkspacePage />} />
                      <Route path="/invoice/:invoiceId" element={<InvoiceDetailPage />} />
                      <Route path="/check-builder" element={<CheckBuilderPage />} />
                      <Route path="/check-registry" element={<CheckRegistryPage />} />
                      <Route path="/upload-audit" element={<UploadAuditPage />} />
                      <Route path="/ap-explorer" element={<APInvoiceExplorerPage />} />
                      <Route path="/controls" element={<ControlsDashboardPage />} />
                      <Route path="/settings" element={<ControlsDashboardPage />} />
                      <Route path="/cases" element={<CasesPage />} />
                      <Route path="/rejections" element={<RejectionsPage />} />
                      <Route path="/mapping" element={<MappingPage />} />
                      <Route path="/evidence" element={<EvidencePage />} />
                      <Route path="/evidence-pack" element={<EvidencePackPage />} />
                      <Route path="/traceability" element={<TraceabilityPage />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </BrowserRouter>
        </ComplianceProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
