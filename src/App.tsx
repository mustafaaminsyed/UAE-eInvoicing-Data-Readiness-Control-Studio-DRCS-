import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ComplianceProvider } from "@/context/ComplianceContext";
import { Navigation } from "@/components/Navigation";
import LandingPage from "./pages/LandingPage";
import UploadPage from "./pages/UploadPage";
import RunChecksPage from "./pages/RunChecksPage";
import DashboardPage from "./pages/DashboardPage";
import ExceptionsPage from "./pages/ExceptionsPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import CheckBuilderPage from "./pages/CheckBuilderPage";
import CheckRegistryPage from "./pages/CheckRegistryPage";
import UploadAuditPage from "./pages/UploadAuditPage";
import ControlsDashboardPage from "./pages/ControlsDashboardPage";
import CasesPage from "./pages/CasesPage";
import RejectionsPage from "./pages/RejectionsPage";
import MappingPage from "./pages/MappingPage";
import EvidencePage from "./pages/EvidencePage";
import EvidencePackPage from "./pages/EvidencePackPage";
import TraceabilityPage from "./pages/TraceabilityPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ComplianceProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <div className="min-h-screen relative overflow-x-clip">
            <div className="pointer-events-none absolute inset-0 grid-veil opacity-50" />
            <Navigation />
            <main className="relative z-10">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/run" element={<RunChecksPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/exceptions" element={<ExceptionsPage />} />
                <Route path="/invoice/:invoiceId" element={<InvoiceDetailPage />} />
                <Route path="/check-builder" element={<CheckBuilderPage />} />
                <Route path="/check-registry" element={<CheckRegistryPage />} />
                <Route path="/upload-audit" element={<UploadAuditPage />} />
                <Route path="/controls" element={<ControlsDashboardPage />} />
                <Route path="/cases" element={<CasesPage />} />
                <Route path="/rejections" element={<RejectionsPage />} />
                <Route path="/mapping" element={<MappingPage />} />
                <Route path="/evidence" element={<EvidencePage />} />
                <Route path="/evidence-pack" element={<EvidencePackPage />} />
                <Route path="/traceability" element={<TraceabilityPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </ComplianceProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
