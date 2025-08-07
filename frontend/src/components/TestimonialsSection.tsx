import { Card, CardContent } from "@/components/ui/card";
import { Quote, Star, LinkedinIcon } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";

const TestimonialsSection = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const element = document.getElementById('testimonials');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <section id="testimonials" className="py-16 md:py-24 bg-secondary/20">
      <div className="container-mobile">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
              <Quote className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-muted-foreground">Testimonials</span>
            </div>
            <h2 className="text-mobile-title font-bold text-foreground mb-4">
              {t('testimonials.title')}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('testimonials.description')}
            </p>
          </div>

          {/* Testimonial Card */}
          <Card className={`bg-gradient-card backdrop-blur-sm border-border shadow-card-modern transition-all duration-800 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <CardContent className="p-6 md:p-8 lg:p-12">
              <div className="flex flex-col items-center text-center">
                {/* Quote Icon with Rating */}
                <div className="relative mb-6">
                  <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-glow-modern">
                    <Quote className="w-8 h-8 text-primary-foreground" />
                  </div>
                  
                  {/* 5-Star Rating */}
                  <div className="flex justify-center mt-4 gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                </div>

                {/* Testimonial Text */}
                <blockquote className="text-base md:text-lg lg:text-xl text-foreground leading-relaxed mb-8 italic max-w-4xl">
                  "{t('testimonials.quote')}"
                </blockquote>

                {/* Attribution */}
                <div className="flex flex-col md:flex-row items-center gap-6 w-full max-w-md">
                  {/* Profile Image Placeholder */}
                  <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center shadow-glow-modern">
                    <span className="text-primary-foreground font-bold text-lg">LK</span>
                  </div>
                  
                  <div className="text-center md:text-left flex-1">
                    <div className="font-semibold text-foreground text-lg mb-1">
                      {t('testimonials.author')}
                    </div>
                    <div className="text-muted-foreground text-sm md:text-base">
                      {t('testimonials.role')}
                    </div>
                    <div className="text-xs md:text-sm text-muted-foreground mt-1">
                      {t('testimonials.date')}
                    </div>
                  </div>

                  {/* LinkedIn Link */}
                  <div className="flex items-center">
                    <a 
                      href="https://linkedin.com/in/lars-kjaersgaard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors duration-300 text-sm touch-manipulation"
                    >
                      <LinkedinIcon className="w-4 h-4" />
                      <span className="hidden md:inline">View Profile</span>
                    </a>
                  </div>
                </div>

                {/* Verification Badge */}
                <div className="mt-8 inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm font-medium">Verified LinkedIn Recommendation</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Social Proof */}
          <div className={`mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-800 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <div className="text-center p-6 bg-gradient-card rounded-2xl border border-border glass-effect">
              <div className="text-2xl font-bold text-foreground mb-2">100%</div>
              <div className="text-sm text-muted-foreground">Client Satisfaction</div>
            </div>
            <div className="text-center p-6 bg-gradient-card rounded-2xl border border-border glass-effect">
              <div className="text-2xl font-bold text-foreground mb-2">15+</div>
              <div className="text-sm text-muted-foreground">Years Experience</div>
            </div>
            <div className="text-center p-6 bg-gradient-card rounded-2xl border border-border glass-effect">
              <div className="text-2xl font-bold text-foreground mb-2">50+</div>
              <div className="text-sm text-muted-foreground">Projects Delivered</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;