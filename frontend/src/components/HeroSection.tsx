import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, Sparkles } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";

const HeroSection = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-primary opacity-10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent opacity-5 rounded-full blur-3xl animate-float" style={{ animationDelay: '-3s' }}></div>
      </div>

      <div className="container-mobile relative z-10">
        <div className="grid lg:grid-cols-5 gap-8 lg:gap-16 items-center">
          {/* Left Column - Text Content (60%) */}
          <div className={`lg:col-span-3 text-center lg:text-left transition-all duration-1000 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            {/* Badge/Intro */}
            <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-muted-foreground">
                Tech Startup Portfolio
              </span>
            </div>

            {/* Main Title */}
            <h1 className="text-mobile-hero font-bold text-foreground mb-6 leading-tight">
              {t('hero.title')}{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                {t('hero.titleHighlight')}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground mb-6 font-medium leading-relaxed">
              {t('hero.subtitle')}
            </p>

            {/* Short Description */}
            <div className="mb-8">
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl lg:max-w-none mx-auto lg:mx-0">
                {t('hero.description')}
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center lg:justify-start">
              <Button 
                size="lg" 
                onClick={() => scrollToSection('contact')}
                className="bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 hover:scale-105 shadow-button-modern touch-manipulation w-full sm:w-auto"
              >
                {t('hero.ctaPrimary')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => scrollToSection('services')}
                className="border-border hover:bg-accent/10 hover:border-accent hover:text-accent transition-all duration-300 glass-effect touch-manipulation w-full sm:w-auto"
              >
                {t('hero.ctaSecondary')}
                <Eye className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {/* Stats/Features */}
            <div className={`mt-12 grid grid-cols-2 md:grid-cols-3 gap-6 max-w-md lg:max-w-none mx-auto lg:mx-0 transition-all duration-1000 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}>
              <div className="text-center lg:text-left">
                <div className="text-2xl font-bold text-foreground">15+</div>
                <div className="text-sm text-muted-foreground">Years Experience</div>
              </div>
              <div className="text-center lg:text-left">
                <div className="text-2xl font-bold text-foreground">50+</div>
                <div className="text-sm text-muted-foreground">Projects Delivered</div>
              </div>
              <div className="text-center lg:text-left col-span-2 md:col-span-1">
                <div className="text-2xl font-bold text-foreground">3</div>
                <div className="text-sm text-muted-foreground">Continents</div>
              </div>
            </div>
          </div>

          {/* Right Column - Image (40%) */}
          <div className={`lg:col-span-2 order-first lg:order-last transition-all duration-1000 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="relative max-w-lg mx-auto">
              {/* Image Container */}
              <div className="relative">
                <img
                  src="/lovable-uploads/0bd02254-2987-4c7d-aa21-15304bc1a3fe.png"
                  alt="Adrian Pop sailing"
                  className="w-full h-auto rounded-2xl shadow-card-modern object-cover transition-transform duration-300 hover:scale-105"
                  style={{ imageRendering: 'crisp-edges' }}
                />
                
                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 bg-gradient-primary p-3 rounded-xl shadow-glow-modern animate-float">
                  <Sparkles className="w-6 h-6 text-primary-foreground" />
                </div>
                
                <div className="absolute -bottom-4 -left-4 bg-gradient-card p-4 rounded-xl shadow-card-modern glass-effect animate-float" style={{ animationDelay: '-1s' }}>
                  <div className="text-sm font-semibold text-foreground">Available for</div>
                  <div className="text-xs text-muted-foreground">Consulting</div>
                </div>
              </div>

              {/* Background Decoration */}
              <div className="absolute inset-0 -z-10">
                <div className="absolute top-8 right-8 w-32 h-32 bg-accent/20 rounded-full blur-2xl"></div>
                <div className="absolute bottom-8 left-8 w-24 h-24 bg-primary/20 rounded-full blur-xl"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center">
          <div className="animate-bounce">
            <div className="w-6 h-10 border-2 border-muted-foreground rounded-full flex justify-center">
              <div className="w-1 h-3 bg-muted-foreground rounded-full mt-2 animate-pulse"></div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Scroll</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;