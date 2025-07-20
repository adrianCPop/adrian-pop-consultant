import { Button } from "@/components/ui/button";
import { ArrowRight, Cpu } from "lucide-react";

const HeroSection = () => {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative py-20 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Badge */}
          <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-6">
            <Cpu className="w-4 h-4" />
            <span className="text-sm font-medium">15+ Years in IT Architecture</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Adrian Pop – IT, AI &{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              eInvoicing Consultant
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl lg:text-2xl text-muted-foreground mb-8 font-medium">
            Helping businesses automate compliance and scale smart.
          </p>

          {/* Description */}
          <div className="max-w-3xl mx-auto mb-10">
            <p className="text-lg text-muted-foreground leading-relaxed">
              I'm Adrian Pop, an experienced software architect and consultant with over 15 years in IT (working since 2006). Based in Tenerife, I work remotely with teams worldwide. I've developed embedded systems, led mobile iOS projects — including reverse-engineering iOS SDK 4.0 and performing a hardware jailbreak on the first iPhone — built enterprise architectures, and delivered eInvoicing solutions.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mt-4">
              I help distributed teams implement robust systems, streamline operations, and stay compliant in complex regulatory environments like CFDI (Mexico), Peppol (EU), and SAF-T. My career spans Europe and the Americas, leading teams of 20+ engineers and delivering critical business solutions.
            </p>
          </div>

          {/* Personal Bio */}
          <div className="max-w-2xl mx-auto mb-10">
            <div className="bg-secondary/20 backdrop-blur border border-border rounded-lg p-6">
              <p className="text-base text-muted-foreground italic">
                Outside of consulting, I enjoy backcountry skiing (since age 3), sailing and chasing the boatlife, and mountain biking.
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => scrollToSection('contact')}
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
            >
              Contact Me
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => scrollToSection('ai-playground')}
              className="border-border hover:bg-accent hover:text-accent-foreground"
            >
              Try AI Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;