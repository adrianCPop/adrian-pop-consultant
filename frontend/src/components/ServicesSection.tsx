import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Cpu, Building, Workflow } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect, useRef } from "react";

const ServicesSection = () => {
  const { t } = useTranslation();
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  
  const services = [
    {
      icon: FileText,
      title: t('services.einvoicing.title'),
      description: t('services.einvoicing.description'),
      color: 'from-blue-500/20 to-indigo-600/20'
    },
    {
      icon: Cpu,
      title: t('services.mobile.title'),
      description: t('services.mobile.description'),
      color: 'from-purple-500/20 to-pink-600/20'
    },
    {
      icon: Building,
      title: t('services.architecture.title'),
      description: t('services.architecture.description'),
      color: 'from-green-500/20 to-emerald-600/20'
    },
    {
      icon: Workflow,
      title: t('services.process.title'),
      description: t('services.process.description'),
      color: 'from-orange-500/20 to-red-600/20'
    }
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cardIndex = parseInt(entry.target.getAttribute('data-index') || '0');
            setVisibleCards(prev => [...prev, cardIndex]);
          }
        });
      },
      { threshold: 0.2 }
    );

    const cards = document.querySelectorAll('.service-card');
    cards.forEach(card => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section id="services" className="py-16 md:py-24 bg-gradient-subtle" ref={sectionRef}>
      <div className="container-mobile">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
              <span className="text-sm font-medium text-muted-foreground">Services</span>
            </div>
            <h2 className="text-mobile-title font-bold text-foreground mb-4">
              {t('services.title')}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('services.description')}
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {services.map((service, index) => (
              <Card 
                key={index}
                data-index={index}
                className={`service-card group bg-gradient-card backdrop-blur-sm border-border hover:shadow-card-hover transition-all duration-500 hover:-translate-y-2 touch-manipulation ${
                  visibleCards.includes(index) 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-8'
                }`}
                style={{
                  transitionDelay: `${index * 150}ms`
                }}
              >
                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${service.color} rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-glow-modern group-hover:scale-110 transition-transform duration-300`}>
                    <service.icon className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors duration-300">
                    {service.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-muted-foreground leading-relaxed text-sm md:text-base">
                    {service.description}
                  </CardDescription>

                  {/* Interactive Element */}
                  <div className="mt-6 flex items-center text-primary opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-0 group-hover:translate-x-2">
                    <span className="text-sm font-medium">Learn more</span>
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-12 md:mt-16">
            <p className="text-muted-foreground mb-4">
              Ready to discuss your project?
            </p>
            <button 
              onClick={() => {
                const element = document.getElementById('contact');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 hover:scale-105 px-6 py-3 rounded-full text-primary-foreground font-medium touch-manipulation"
            >
              <span>Get in Touch</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;