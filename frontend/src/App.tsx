import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ThemeEditor from "./pages/ThemeEditor";
import FiscalAlerts from "./pages/FiscalAlerts";
import ResearchModalDemo from "./pages/ResearchModalDemo";
import { TranslationProvider } from "@/components/TranslationProvider";

const queryClient = new QueryClient();

const App = () => (
  <TranslationProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/fiscal-alerts" element={<FiscalAlerts />} />
          <Route path="/theme-editor" element={<ThemeEditor />} />
          <Route path="/research-demo" element={<ResearchModalDemo />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </TranslationProvider>
);

export default App;
