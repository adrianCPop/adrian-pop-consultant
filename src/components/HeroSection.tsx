import { Button } from "@/components/ui/button";
import { ArrowRight, Eye } from "lucide-react";

const HeroSection = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content (60%) */}
          <div className="lg:col-span-3">
            {/* Main Title */}
            <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Adrian Pop –{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Navigating Complexity with Clarity
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl lg:text-2xl text-muted-foreground mb-8 font-medium">
              Technical consultant for eInvoicing, AI compliance, and scalable software systems.
            </p>

            {/* Short Description */}
            <div className="mb-10">
              <p className="text-lg text-muted-foreground leading-relaxed">
                From reverse-engineering iOS to leading eInvoicing projects across continents — and navigating offshore with calm focus — I help teams simplify and scale their systems.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                onClick={() => scrollToSection('contact')}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                Let's Talk
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => scrollToSection('services')}
                className="border-border hover:bg-accent hover:text-accent-foreground"
              >
                See My Work
                <Eye className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Right Column - Image (40%) */}
          <div className="lg:col-span-2 order-first lg:order-last">
            <div className="relative">
              <img
                src="/lovable-uploads/0bd02254-2987-4c7d-aa21-15304bc1a3fe.png"
                alt="Adrian Pop sailing"
                className="w-full h-auto rounded-lg shadow-elegant object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;