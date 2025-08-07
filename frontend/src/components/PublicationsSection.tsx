import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, BookOpen, Calendar, ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useState, useEffect } from "react";

const PublicationsSection = () => {
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

    const element = document.getElementById('publications');
    if (element) observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return (
    <section id="publications" className="py-16 md:py-24 bg-secondary/20">
      <div className="container-mobile">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-card px-4 py-2 rounded-full border border-border mb-6 glass-effect">
              <BookOpen className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-muted-foreground">Publications</span>
            </div>
            <h2 className="text-mobile-title font-bold text-foreground mb-4">
              {t('publications.title')}
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t('publications.description')}
            </p>
          </div>

          {/* Publications Grid */}
          <div className={`space-y-8 transition-all duration-800 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            {/* Published Article */}
            <Card className="group bg-gradient-card backdrop-blur-sm border-border hover:shadow-card-hover transition-all duration-300 hover:-translate-y-2">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  {/* Icon */}
                  <div className="flex-shrink-0 mx-auto md:mx-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-glow-modern">
                      <BookOpen className="w-8 h-8 text-purple-400" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                      <h3 className="text-xl md:text-2xl font-semibold text-foreground leading-tight">
                        "{t('publications.article.title')}"
                      </h3>
                      <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">{t('publications.article.date')}</span>
                      </div>
                    </div>
                    
                    {/* Abstract/Description */}
                    <p className="text-muted-foreground mb-6 text-sm md:text-base leading-relaxed">
                      An in-depth exploration of how strengths-based development can transform software teams, 
                      focusing on individual talents, team dynamics, and long-term organizational success.
                    </p>

                    {/* Meta Info */}
                    <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 mb-6">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span>Published on Medium</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span>5 min read</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* CTA */}
                    <a 
                      href="https://medium.com/@adrian.c.pop/strengths-based-development-a-long-term-strategy-for-software-teams-c5dce95bcb7a"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 hover:scale-105 px-6 py-3 rounded-full text-primary-foreground font-medium touch-manipulation shadow-button-modern"
                    >
                      <span>{t('publications.readArticle')}</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Second Published Article */}
            <Card className="group bg-gradient-card backdrop-blur-sm border-border hover:shadow-card-hover transition-all duration-300 hover:-translate-y-2">
              <CardContent className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row items-start gap-6">
                  {/* Icon */}
                  <div className="flex-shrink-0 mx-auto md:mx-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-glow-modern">
                      <BookOpen className="w-8 h-8 text-blue-400" />
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                      <h3 className="text-xl md:text-2xl font-semibold text-foreground leading-tight">
                        "AI as an Indispensable Tool: Adapting or Becoming Irrelevant"
                      </h3>
                      <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm">Medium • Aug</span>
                      </div>
                    </div>
                    
                    {/* Abstract/Description */}
                    <p className="text-muted-foreground mb-6 text-sm md:text-base leading-relaxed">
                      Exploring the critical importance of adapting to AI technologies in the modern workplace, 
                      and why embracing these tools is essential for staying relevant in an evolving digital landscape.
                    </p>

                    {/* Meta Info */}
                    <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 mb-6">
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span>Published on Medium</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span>6 min read</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* CTA */}
                    <a 
                      href="https://medium.com/@adrian.c.pop/ai-as-an-indispensable-tool-adapting-or-becoming-irrelevant-d6cbb376fcdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 hover:scale-105 px-6 py-3 rounded-full text-primary-foreground font-medium touch-manipulation shadow-button-modern"
                    >
                      <span>Read Article</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coming Soon Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <Card className="bg-gradient-card backdrop-blur-sm border-border opacity-60">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-600/20 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-6 h-6 text-orange-400" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">
                    "The Abstract Engine: Taming AI's Power Before It Tames Us"
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    From electricity to cognition: why AI is the new current we must learn to navigate.
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-background/50 px-3 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    <span>Coming 2 2025</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card backdrop-blur-sm border-border opacity-60">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-600/20 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">
                    "Smell the Hype: Why AI Needs Fewer Evangelists and More Adults in the Room"
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    If Agile taught us anything, it's that every great idea can be ruined by those who scream it the loudest.
                  </p>
                  <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-background/50 px-3 py-1 rounded-full">
                    <Calendar className="w-3 h-3" />
                    <span>Coming Q3 2025</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Call to Action */}
          <div className={`text-center mt-12 transition-all duration-800 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}>
            <p className="text-muted-foreground mb-4">
              Want to discuss technical writing or collaboration opportunities?
            </p>
            <button 
              onClick={() => {
                const element = document.getElementById('contact');
                element?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 text-primary hover:text-accent transition-colors duration-300 font-medium touch-manipulation"
            >
              <span>Let's Connect</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PublicationsSection;