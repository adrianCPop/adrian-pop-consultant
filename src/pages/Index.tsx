import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import ServicesSection from "@/components/ServicesSection";
import TestimonialsSection from "@/components/TestimonialsSection";

import PublicationsSection from "@/components/PublicationsSection";
import ContactSection from "@/components/ContactSection";
import InvoiceLawSection from "@/components/InvoiceLawSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <Header />
      
      <main className="flex-1">
        <HeroSection />
        <ServicesSection />
        <TestimonialsSection />
        
        <InvoiceLawSection />
        <PublicationsSection />
        <ContactSection />
      </main>

      <Footer />
    </div>
  );
};

export default Index;
