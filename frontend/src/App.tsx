import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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

const App = () => {
  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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

            <Route path="/contact" element={<Navigate replace to="/contact-book" />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
