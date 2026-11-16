import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import SiteLayout from "@/components/site/SiteLayout";
import HomePage from "@/pages/site/HomePage";
import WorkWithAdrianPage from "@/pages/site/WorkWithAdrianPage";
import TopicPage from "@/pages/site/TopicPage";
import CaseStudiesPage from "@/pages/site/CaseStudiesPage";
import InsightsPage from "@/pages/site/InsightsPage";
import SpeakingWorkshopsPage from "@/pages/site/SpeakingWorkshopsPage";
import AboutPage from "@/pages/site/AboutPage";
import ExperienceCVPage from "@/pages/site/ExperienceCVPage";
import AIAdvisorPage from "@/pages/site/AIAdvisorPage";
import ContactBookPage from "@/pages/site/ContactBookPage";
import NotFound from "@/pages/NotFound";
import ChatWidget from "@/components/ChatWidget";
import { isVoyagePath } from "@/lib/voyagePaths";

// The voyage pages bring a map and other code the rest of the site does not need,
// so they are only downloaded when one of them is opened.
const VoyagePage = lazy(() => import("@/pages/site/VoyagePage"));
const VoyageLogPage = lazy(() => import("@/pages/site/VoyageLogPage"));
const VoyageAdminPage = lazy(() => import("@/pages/site/VoyageAdminPage"));

/**
 * The consulting site's chat bubble. Not on the voyage pages: it belongs to the
 * consulting site, and on a phone it sits in the corner on top of their controls.
 * Decided from the address, so it is never drawn there, not even while the page
 * itself is still being downloaded.
 */
const SiteChat = () => (isVoyagePath(useLocation().pathname) ? null : <ChatWidget />);

const App = () => {
  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SiteChat />
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/work-with-adrian" element={<WorkWithAdrianPage />} />

            <Route path="/ai-adoption-strategy" element={<TopicPage />} />
            <Route path="/ai-assisted-delivery-systems" element={<TopicPage />} />
            <Route path="/management-ai-enablement" element={<TopicPage />} />
            <Route path="/architecture-advisory" element={<TopicPage />} />
            <Route path="/compliance-einvoicing" element={<TopicPage />} />
            <Route path="/methods-frameworks" element={<TopicPage />} />

            <Route path="/case-studies" element={<CaseStudiesPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/speaking-workshops" element={<SpeakingWorkshopsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/experience-cv" element={<ExperienceCVPage />} />
            <Route path="/ai-advisor" element={<AIAdvisorPage />} />
            <Route path="/contact-book" element={<ContactBookPage />} />

            {/* Voyage tracker. Not linked from the navigation. */}
            <Route path="/voyage" element={<Suspense fallback={null}><VoyagePage /></Suspense>} />
            <Route path="/voyage/log" element={<Suspense fallback={null}><VoyageLogPage /></Suspense>} />
            <Route path="/voyage/admin" element={<Suspense fallback={null}><VoyageAdminPage /></Suspense>} />

            <Route path="/contact" element={<Navigate replace to="/contact-book" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
